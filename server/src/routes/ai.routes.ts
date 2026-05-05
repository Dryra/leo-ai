import { Router } from "express";
import multer from "multer";
import { OpenAI, toFile } from "openai";
import fs from "node:fs";
import path from "node:path";

const router = Router();
const upload = multer({ dest: "uploads/" });

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

function getConversationInput(userMessage: string) {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const recentMessages = [
    systemMessage,
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
