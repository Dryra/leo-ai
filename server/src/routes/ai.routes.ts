import { Router } from "express";
import multer from "multer";
import { OpenAI, toFile } from "openai";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";

const router = Router();
const upload = multer({ dest: "uploads/" });

const objectContext = {
  summary: "",
  fileName: "",
  detectedType: "",
};

type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  source?: "object";
};

type OpenAIConversationMessage = Pick<ConversationMessage, "role" | "content">;

const MAX_HISTORY_MESSAGES = 20;

const systemMessage: ConversationMessage = {
  role: "system",
  content:
    "You are LEO AI, a futuristic AI avatar. Keep replies short, expressive, natural, and conversational. You remember the recent conversation and may refer to things the user mentioned earlier when relevant.",
};

const conversationHistory: ConversationMessage[] = [systemMessage];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".scss",
  ".css",
  ".html",
];

function toDataUrl(filePath: string, mimeType: string) {
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

type ObjectAnalysis = {
  detectedType: string;
  summary: string;
  suggestedActions: string[];
};

type ChatStructuredResponse = {
  reply: string;
  shouldCreateFile: boolean;
  fileName: string | null;
  mimeType: string | null;
  fileContent: string | null;
};

type ChatAttachment = {
  fileName: string;
  mimeType: string;
  data: string;
};

const CHAT_FILE_INSTRUCTIONS: OpenAIConversationMessage = {
  role: "system",
  content: `For this chat response, return JSON matching the schema.
Use reply for the normal conversational answer.
Set shouldCreateFile to false for ordinary questions and ordinary chat.
Set shouldCreateFile to true only when the user explicitly asks you to create, rewrite, edit, export, or send back a downloadable file.
If the user asks you to generate, create, draw, make, or render an image, do not ask for confirmation. Set shouldCreateFile to true, mimeType to image/png, fileName to a short descriptive .png filename, and fileContent to a detailed image-generation prompt.
When shouldCreateFile is true, include fileName, mimeType, and fileContent.
For text-like files, fileContent must be the full file contents.
For PDFs, fileContent must be plain text that the server can render into a PDF.
For image files like PNG, JPEG, or WebP, fileContent must be a detailed image-generation prompt, not base64 or binary data.`,
};

const TEXT_ATTACHMENT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/json",
  "application/xml",
  "text/xml",
]);

function normalizeAnalysis(value: unknown): ObjectAnalysis {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid analysis object");
  }

  const analysis = value as Partial<ObjectAnalysis>;

  return {
    detectedType:
      typeof analysis.detectedType === "string"
        ? analysis.detectedType
        : "Unknown",
    summary:
      typeof analysis.summary === "string"
        ? analysis.summary
        : "No summary available.",
    suggestedActions: [],
  };
}

function parseChatResponse(text: string): ChatStructuredResponse {
  try {
    const parsed = JSON.parse(text) as Partial<ChatStructuredResponse>;

    return {
      reply:
        typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply
          : text,
      shouldCreateFile: parsed.shouldCreateFile === true,
      fileName: typeof parsed.fileName === "string" ? parsed.fileName : null,
      mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : null,
      fileContent:
        typeof parsed.fileContent === "string" ? parsed.fileContent : null,
    };
  } catch {
    return {
      reply: text,
      shouldCreateFile: false,
      fileName: null,
      mimeType: null,
      fileContent: null,
    };
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, "-").trim() || "generated-file.txt";
}

function getImageGenerationPrompt(message: string) {
  const normalizedMessage = message.toLowerCase();
  const asksForImage =
    /\b(generate|create|draw|make|render|design)\b/.test(normalizedMessage) &&
    /\b(image|picture|pic|photo|illustration|artwork|poster|logo|png|jpg|jpeg|webp)\b/.test(
      normalizedMessage,
    );

  if (!asksForImage) return null;

  return message
    .replace(/\b(can you|could you|please)\b/gi, "")
    .replace(/\b(generate|create|draw|make|render|design)\b/gi, "")
    .replace(/\b(an?|the)?\s*(image|picture|pic|photo|illustration|artwork|png|jpg|jpeg|webp)\b/gi, "")
    .trim();
}

function createImageFileName(prompt: string) {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `${slug || "generated-image"}.png`;
}

function ensureFileExtension(fileName: string, extension: string) {
  return fileName.toLowerCase().endsWith(`.${extension}`)
    ? fileName
    : `${fileName}.${extension}`;
}

function getImageOutputFormat(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return {
        extension: "jpg",
        mimeType: "image/jpeg",
        outputFormat: "jpeg" as const,
      };
    case "image/webp":
      return {
        extension: "webp",
        mimeType: "image/webp",
        outputFormat: "webp" as const,
      };
    case "image/png":
      return {
        extension: "png",
        mimeType: "image/png",
        outputFormat: "png" as const,
      };
    default:
      return null;
  }
}

async function createImageAttachment(
  fileName: string,
  mimeType: string,
  prompt: string,
): Promise<ChatAttachment | undefined> {
  const imageFormat = getImageOutputFormat(mimeType);

  if (!imageFormat) return undefined;

  const imageResponse = await openai.images.generate({
    model: "gpt-image-1-mini",
    prompt,
    n: 1,
    size: "1024x1024",
    output_format: imageFormat.outputFormat,
  });
  const imageBase64 = imageResponse.data?.[0]?.b64_json;

  if (!imageBase64) return undefined;

  return {
    fileName: ensureFileExtension(fileName, imageFormat.extension),
    mimeType: imageFormat.mimeType,
    data: imageBase64,
  };
}

function createPdfBuffer(text: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      margin: 56,
      size: "LETTER",
      info: {
        Title: "Generated document",
        Creator: "LEO AI",
      },
    });
    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.font("Helvetica").fontSize(11).text(text, {
      align: "left",
      lineGap: 4,
    });
    document.end();
  });
}

async function createChatAttachment(
  chatResponse: ChatStructuredResponse,
): Promise<ChatAttachment | undefined> {
  if (
    !chatResponse.shouldCreateFile ||
    !chatResponse.fileName ||
    !chatResponse.mimeType ||
    !chatResponse.fileContent
  ) {
    return undefined;
  }

  const fileName = sanitizeFileName(chatResponse.fileName);

  if (chatResponse.mimeType === "application/pdf") {
    return {
      fileName: ensureFileExtension(fileName, "pdf"),
      mimeType: "application/pdf",
      data: (await createPdfBuffer(chatResponse.fileContent)).toString(
        "base64",
      ),
    };
  }

  if (chatResponse.mimeType.startsWith("image/")) {
    return createImageAttachment(
      fileName,
      chatResponse.mimeType,
      chatResponse.fileContent,
    );
  }

  if (!TEXT_ATTACHMENT_MIME_TYPES.has(chatResponse.mimeType)) {
    return undefined;
  }

  return {
    fileName,
    mimeType: chatResponse.mimeType,
    data: Buffer.from(chatResponse.fileContent, "utf8").toString("base64"),
  };
}

/*
suggestedActions: Array.isArray(analysis.suggestedActions)
      ? analysis.suggestedActions.filter(
          (action): action is string => typeof action === "string",
        )
      : ["Summarize it", "Find problems", "Improve it"],
      */

function parseAnalysis(text: string): ObjectAnalysis {
  const jsonMatch = text.trim().match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      detectedType: "Unknown",
      summary: text.trim(),
      suggestedActions: ["Summarize it", "Find problems", "Improve it"],
    };
  }

  try {
    return normalizeAnalysis(JSON.parse(jsonMatch[0]));
  } catch {
    return {
      detectedType: "Unknown",
      summary: text.trim(),
      suggestedActions: ["Summarize it", "Find problems", "Improve it"],
    };
  }
}

function toOpenAIConversationMessage(
  message: ConversationMessage,
): OpenAIConversationMessage {
  return {
    role: message.role,
    content: message.content,
  };
}

function getConversationInput(userMessage: string) {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const objectContextMessage: ConversationMessage | null = objectContext.summary
    ? {
        role: "system",
        content: `Current uploaded workspace object:
Filename: ${objectContext.fileName}
Type: ${objectContext.detectedType}
Summary: ${objectContext.summary}

When the user asks follow-up questions like summarize, improve, compare, find problems, or explain, use this uploaded object as context.`,
      }
    : null;

  console.log("## context", objectContextMessage);

  const recentMessages = [
    systemMessage,
    ...(objectContextMessage ? [objectContextMessage] : []),
    ...conversationHistory
      .filter((message) => message.role !== "system")
      .slice(-MAX_HISTORY_MESSAGES),
  ];

  return recentMessages.map(toOpenAIConversationMessage);
}

function rememberAssistantMessage(
  message: string,
  source?: ConversationMessage["source"],
) {
  conversationHistory.push({
    role: "assistant",
    content: message,
    source,
  });

  const nonSystemMessages = conversationHistory.filter(
    (message) => message.role !== "system",
  );

  if (nonSystemMessages.length > MAX_HISTORY_MESSAGES) {
    const messagesToRemove = nonSystemMessages.length - MAX_HISTORY_MESSAGES;

    let removed = 0;

    for (
      let i = 0;
      i < conversationHistory.length && removed < messagesToRemove;
      i++
    ) {
      if (conversationHistory[i].role === "system") continue;

      conversationHistory.splice(i, 1);
      removed++;
      i--;
    }
  }
}

router.post("/object", upload.single("object"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No object uploaded" });
  }

  const filePath = path.resolve(file.path);
  const ext = path.extname(file.originalname).toLowerCase();

  try {
    const analysisPrompt = `
Analyze this uploaded object for a futuristic spatial AI workspace.

Return JSON only:
{
  "detectedType": "short type label",
  "summary": "short useful summary",
  "suggestedActions": ["action 1", "action 2", "action 3"]
}
`;

    let response;

    if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
      response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: analysisPrompt },
              {
                type: "input_image",
                image_url: toDataUrl(filePath, file.mimetype),
                detail: "auto",
              },
            ],
          },
        ],
      });
    } else if (file.mimetype === "application/pdf" || ext === ".pdf") {
      const uploadedFile = await openai.files.create({
        file: await toFile(fs.createReadStream(filePath), file.originalname, {
          type: file.mimetype,
        }),
        purpose: "user_data",
      });

      response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_file", file_id: uploadedFile.id },
              { type: "input_text", text: analysisPrompt },
            ],
          },
        ],
      });
    } else if (TEXT_EXTENSIONS.includes(ext)) {
      const content = fs.readFileSync(filePath, "utf8").slice(0, 120_000);

      response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${analysisPrompt}\n\nFilename: ${file.originalname}\n\nContent:\n${content}`,
              },
            ],
          },
        ],
      });
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const result = parseAnalysis(response.output_text);

    const aiText = `I inspected ${result.detectedType}. ${result.summary}`;

    //Try: ${result.suggestedActions.join(", ")}`;

    rememberAssistantMessage(aiText, "object");

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: aiText,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    objectContext.summary = result.summary;
    objectContext.fileName = file.originalname;
    objectContext.detectedType = result.detectedType;

    conversationHistory.push({
      role: "user",
      content: `The user uploaded ${file.originalname}. Object summary: ${result.summary}`,
      source: "object",
    });

    res.json({
      objectId: randomUUID(),
      ...result,
      transcript: `Uploaded ${file.originalname}`,
      reply: aiText,
      audio: audioBuffer.toString("base64"),
      mimeType: "audio/mpeg",
      emotion: detectEmotion(aiText),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Object analysis failed" });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

router.delete("/object", (_req, res) => {
  objectContext.summary = "";
  objectContext.fileName = "";
  objectContext.detectedType = "";

  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    if (conversationHistory[i].source !== "object") continue;

    conversationHistory.splice(i, 1);
  }

  res.status(204).send();
});

// Text messages
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const imageGenerationPrompt = getImageGenerationPrompt(message);

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [CHAT_FILE_INSTRUCTIONS, ...getConversationInput(message)],
      text: {
        format: {
          type: "json_schema",
          name: "chat_response",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              shouldCreateFile: { type: "boolean" },
              fileName: { type: ["string", "null"] },
              mimeType: { type: ["string", "null"] },
              fileContent: { type: ["string", "null"] },
            },
            required: [
              "reply",
              "shouldCreateFile",
              "fileName",
              "mimeType",
              "fileContent",
            ],
          },
        },
      },
    });
    const chatResponse = parseChatResponse(response.output_text);
    const aiText = chatResponse.reply;
    const attachment = imageGenerationPrompt
      ? await createImageAttachment(
          createImageFileName(imageGenerationPrompt),
          "image/png",
          imageGenerationPrompt,
        )
      : await createChatAttachment(chatResponse);
    const responseText =
      imageGenerationPrompt && attachment
        ? "I generated the image. You can download it below."
        : aiText;

    rememberAssistantMessage(responseText);

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: responseText,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.json({
      text: responseText,
      audio: audioBuffer.toString("base64"),
      mimeType: "audio/mpeg",
      emotion: detectEmotion(responseText),
      ...(attachment ? { attachment } : {}),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI request failed" });
  }
});

// Voice messages
router.post("/voice", upload.single("audio"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  try {
    const audioPath = path.resolve(file.path);

    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(
        fs.createReadStream(audioPath),
        file.originalname || "voice.webm",
        { type: file.mimetype },
      ),
      model: "gpt-4o-mini-transcribe",
    });

    const userText = transcription.text;
    const imageGenerationPrompt = getImageGenerationPrompt(userText);

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [CHAT_FILE_INSTRUCTIONS, ...getConversationInput(userText)],
      text: {
        format: {
          type: "json_schema",
          name: "chat_response",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              shouldCreateFile: { type: "boolean" },
              fileName: { type: ["string", "null"] },
              mimeType: { type: ["string", "null"] },
              fileContent: { type: ["string", "null"] },
            },
            required: [
              "reply",
              "shouldCreateFile",
              "fileName",
              "mimeType",
              "fileContent",
            ],
          },
        },
      },
    });

    const chatResponse = parseChatResponse(response.output_text);
    const aiText = chatResponse.reply;
    const attachment = imageGenerationPrompt
      ? await createImageAttachment(
          createImageFileName(imageGenerationPrompt),
          "image/png",
          imageGenerationPrompt,
        )
      : await createChatAttachment(chatResponse);
    const responseText =
      imageGenerationPrompt && attachment
        ? "I generated the image. You can download it below."
        : aiText;

    rememberAssistantMessage(responseText);

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "echo",
      input: responseText,
      //format: "mp3",
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    fs.unlinkSync(audioPath);

    res.json({
      transcript: userText,
      reply: responseText,
      audio: audioBuffer.toString("base64"),
      mimeType: "audio/mpeg",
      emotion: detectEmotion(responseText),
      ...(attachment ? { attachment } : {}),
    });
  } catch (error) {
    console.error(error);

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.status(500).json({ error: "Voice request failed" });
  }
});

type DetectedEmotion = "neutral" | "happy" | "sad" | "angry" | "bored";

const EMOTION_KEYWORDS: Record<DetectedEmotion, string[]> = {
  happy: [
    "great",
    "awesome",
    "nice",
    "good",
    "glad",
    "happy",
    "love",
    "perfect",
    "excellent",
    "amazing",
    "congrats",
    "congratulations",
    "yay",
    "yes",
    "buzzing",
    "smile",
  ],
  sad: [
    "sorry",
    "unfortunately",
    "sad",
    "upset",
    "hurt",
    "miss",
    "lost",
    "lonely",
    "bad news",
    "that's hard",
    "that is hard",
    "i understand",
  ],
  angry: [
    "angry",
    "mad",
    "furious",
    "annoyed",
    "frustrating",
    "frustrated",
    "ridiculous",
    "unacceptable",
    "not okay",
    "stop",
    "hate",
  ],
  bored: [
    "bored",
    "boring",
    "whatever",
    "anyway",
    "meh",
    "hmm",
    "maybe",
    "i guess",
    "not much",
    "same old",
    "sure",
  ],
  neutral: [],
};

function detectEmotion(text: string): DetectedEmotion {
  const lower = text.toLowerCase();

  const scores = Object.entries(EMOTION_KEYWORDS).map(
    ([emotion, keywords]) => ({
      emotion: emotion as DetectedEmotion,
      score: keywords.filter((keyword) => lower.includes(keyword)).length,
    }),
  );

  const bestMatch = scores
    .filter(({ emotion }) => emotion !== "neutral")
    .sort((a, b) => b.score - a.score)[0];

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.emotion;
  }

  return "neutral";
}

export default router;
