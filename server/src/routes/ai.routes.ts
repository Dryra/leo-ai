import { Router } from "express";
import multer from "multer";
import { OpenAI, toFile } from "openai";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
};

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
    suggestedActions: Array.isArray(analysis.suggestedActions)
      ? analysis.suggestedActions.filter(
          (action): action is string => typeof action === "string",
        )
      : ["Summarize it", "Find problems", "Improve it"],
  };
}

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

  return recentMessages;
}

function rememberAssistantMessage(message: string) {
  conversationHistory.push({
    role: "assistant",
    content: message,
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

    const aiText = `I inspected ${result.detectedType}. ${result.summary}

Try: ${result.suggestedActions.join(", ")}`;

    rememberAssistantMessage(aiText);

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

// Text messages
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: getConversationInput(message),
    });
    const aiText = response.output_text;

    rememberAssistantMessage(aiText);

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: aiText,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.json({
      text: aiText,
      audio: audioBuffer.toString("base64"),
      mimeType: "audio/mpeg",
      emotion: detectEmotion(aiText),
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

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: getConversationInput(userText),
    });

    const aiText = response.output_text;
    rememberAssistantMessage(aiText);

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "echo",
      input: aiText,
      //format: "mp3",
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    fs.unlinkSync(audioPath);

    res.json({
      transcript: userText,
      reply: aiText,
      audio: audioBuffer.toString("base64"),
      mimeType: "audio/mpeg",
      emotion: detectEmotion(aiText),
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
