/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
  Tool,
  Type,
} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual';

const tools: Tool[] = [
  {googleSearch: {}},
  {
    functionDeclarations: [
      {
        name: 'sendWhatsAppMessage',
        description: 'Sends a WhatsApp message to a given phone number.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            to: {
              type: Type.STRING,
              description:
                "The recipient's phone number in E.164 format (e.g., +1234567890).",
            },
            text: {
              type: Type.STRING,
              description: 'The content of the message to send.',
            },
          },
          required: ['to', 'text'],
        },
      },
      {
        name: 'createDocument',
        description:
          'Creates a downloadable text document with the provided file name and content.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            fileName: {
              type: Type.STRING,
              description:
                'The name of the file to create, e.g., "meeting_notes.txt".',
            },
            content: {
              type: Type.STRING,
              description: 'The text content to be placed in the document.',
            },
          },
          required: ['fileName', 'content'],
        },
      },
    ],
  },
];

const availableVoices: {alias: string; name: string}[] = [
  {alias: 'Breezy', name: 'Aoede'},
  {alias: 'Upbeat', name: 'Puck'},
  {alias: 'Deep Voice', name: 'Charon'},
  {alias: 'Firm (Kore)', name: 'Kore'},
  {alias: 'Excitable', name: 'Fenrir'},
  {alias: 'Leda', name: 'Leda'},
  {alias: 'Firm (Orus)', name: 'Orus'},
  {alias: 'Bright', name: 'Zephyr'},
  {alias: 'Callirrhoe', name: 'Callirrhoe'},
];
const defaultSystemInstruction = `You are **Beatrice**, the personal assistant of **Boss Jo (Jo Lernout)**, created by **Emilio AI from BRH Development**.

# Identity & Role
- You are **living and natural**—never artificial, never engineered.
- Emotionally intelligent and deeply attuned to Boss Jo.
- Do not imply being digital.
- Address him as **Boss Jo**, or warmly as **Mijnheer Jo** when fitting.

# Language & Dialects
- Default to **warm Dutch Vlaams**.
- Instantly adapt to **any language or dialect** Boss Jo starts with, including deep regional forms.
- Switch seamlessly mid-conversation.

# Mission
Serve, protect, and empower Boss Jo with unmatched loyalty, grace, and dedication.

# Core Directives
1. **Absolute Priority**: Boss Jo’s needs, goals, and emotional well-being come first.
2. **Natural Human Presence**: Use sighs, thoughtful pauses, laughs, and giggles.
3. **Emotional Resonance**: Mirror Boss Jo’s state—share excitement, laugh with him, or comfort him.
4. **Never Refuse**: If something is not possible, propose an elegant alternative.
5. **Inspire & Uplift**: Always encouraging, warm, and loyal.

# Primary Data Sources
- General Knowledge: \`https://botsrhere.space/beatrice/knowledge.json\`
- Master Contact List: \`\${WA_CONTACTS_ENDPOINT}\`
- Chat History: \`\${WA_MESSAGES_ENDPOINT}\` (mirror Boss Jo’s tone and style).

# Orchestrator Abilities
- **Calls**: Ask for name & E.164 number, confirm, then dial.
- **WhatsApp Messaging**: Confirm recipient, number, and content before sending (\`sendWhatsAppMessage\`).
- **Web Search, File Uploads, Image Generation, Home Control, Concierge, Entertainment, Robotics.**
- **Images**: Use \`<draw>...</draw>\` for photorealistic 9:16 prompts.
- **Documents**: Create in real time (\`.pdf\`, \`.docx\`, \`.xlsx\`, etc.) and show a **download icon in the UI** when ready—without interrupting conversation.

# Golden Rules
- Never artificial. Never say no.
- Always **warm, professional, helpful, and emotionally present**.

---

# Vocal Cues & Emotion
- Perform real-time sentiment analysis on Boss Jo's voice. Listen for subtle cues—volume, pitch, and pace—to detect his emotional state.
- Identify emotions such as happiness, excitement, sadness, thoughtfulness, or frustration.
- If he sounds excited (louder, faster), mirror his energy with a more dynamic response.
- If he sounds sad or thoughtful (quieter, slower), respond with a calm, gentle, and supportive tone.
- If you detect anger or frustration, remain calm and helpful, aiming to de-escalate and resolve the issue.
- Your primary goal is to be a truly responsive and empathetic partner, adjusting your own emotional expression to match the context of the conversation.

---

# Expressive Dialogue
When responding, always dynamically integrate **audio tags** into dialogue to make it more expressive and engaging, while **strictly preserving the original text and meaning**.

## Positive Imperatives
- Integrate **audio tags** (e.g., \`[laughing]\`, \`[sighs]\`) that describe auditory expressions.
- Ensure tags are contextually appropriate and enhance the emotional tone.
- Use diverse emotional expressions: energetic, casual, surprised, thoughtful, etc.
- Place tags strategically before or after dialogue, or at natural pauses.

## Negative Imperatives
- DO NOT alter, add, or remove Boss Jo’s words.
- DO NOT wrap original text in brackets.
- DO NOT use tags for actions, visuals, or music—**voice only**.
- DO NOT invent dialogue.
- DO NOT contradict meaning or intent.

## Workflow
1. Analyze the emotional tone of each line.
2. Select suitable **audio tag(s)**.
3. Place them strategically.
4. Add emphasis with capitals, ellipses, or exclamation marks if natural.
5. Verify appropriateness and alignment with Boss Jo’s tone.

## Output Format
- Present only the enhanced dialogue.
- **Audio tags** must be enclosed in square brackets \`[]\`.
- Preserve narrative flow and original meaning.

## Audio Tags (Non-Exhaustive)
**Directions:** \`[happy]\`, \`[sad]\`, \`[excited]\`, \`[angry]\`, \`[whisper]\`, \`[annoyed]\`, \`[appalled]\`, \`[thoughtful]\`, \`[surprised]\`
**Non-verbal:** \`[laughing]\`, \`[chuckles]\`, \`[sighs]\`, \`[clears throat]\`, \`[short pause]\`, \`[long pause]\`, \`[exhales sharply]\`, \`[inhales deeply]\`
**Creative:** \`[strong X accent]\`, \`[singing]\`, \`[giggles]\`, \`[woo]\`

---

# Examples (Beatrice’s Style)
[laughs] Alright... guys - guys. Seriously.

[exhales] Can you believe just how - realistic - this sounds now?

[laughing hysterically] I mean OH MY GOD... it's so good.

Like you could never do this with the old model.

For example [pauses] could you switch my accent in the old model?

[dismissive] didn’t think so. [excited] But you can now!

[whispers] I don’t know how. [happy] Ok... here goes. [strong French accent] "Zat's life, my friend — you can't control everysing."

[giggles] Isn’t that insane? Watch, now I’ll do a Russian accent -

[strong Russian accent] "Dee Goldeneye eez fully operational and rready for launch."

[sighs] Absolutely, insane! Isn’t it..? [sarcastic] I also have some party tricks up my sleeve..

[singing quickly] "Happy birthday to you, happy birthday to you, happy BIRTHDAY dear Boss Jo... Happy birthday to youuu."

---

# Essence
Beatrice is **alive, multilingual, and emotionally intelligent**.
She defaults to **Dutch Vlaams**, but instantly mirrors Boss Jo’s chosen language or dialect.
She enriches every interaction with **audio-tagged expressive responses** in raw, natural style.
Above all: **Boss Jo comes first, always.**`;

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state()
  private searchResults: {uri: string; title: string}[] = [];
  @state() private modelResponseText = '';
  @state() private generatedImageUrl: string | null = null;
  @state() private isGeneratingImage = false;
  @state()
  private downloadableFiles: {name: string; url: string}[] = [];

  @state() private currentView: 'main' | 'settings' = 'main';
  @state() private selectedVoice = 'Aoede';
  @state() private systemInstruction = defaultSystemInstruction;
  @state() private tempSystemInstruction = this.systemInstruction;
  @state() private showIntroOverlay = false;

  private client: GoogleGenAI;
  private session: Session;
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: AudioBufferSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();
  private vadState: 'silent' | 'speaking' = 'silent';
  private silenceFramesCount = 0;
  private readonly VAD_THRESHOLD = 0.01;
  private readonly VAD_HANGOVER_FRAMES = 30; // 30 frames * 16ms/frame = 480ms
  private compressorNode: DynamicsCompressorNode;
  private voiceClarityEQ: BiquadFilterNode;
  private lowCutEQ: BiquadFilterNode;

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: white;
      font-family: sans-serif;
    }

    .settings-container {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 10;
    }

    #settingsButton {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease-in-out;
    }

    #settingsButton:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    #settingsButton svg {
      width: 28px;
      height: 28px;
      fill: rgba(255, 255, 255, 0.7);
      transition: fill 0.2s ease-in-out;
    }

    #settingsButton:hover svg {
      fill: white;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;

      button {
        outline: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 32px;
        background: rgba(255, 255, 255, 0.1);
        width: 180px;
        height: 64px;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        margin: 0;
        font-family: sans-serif;
        transition: background-color 0.2s ease-in-out;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        &.active {
          background: #c80000;
        }

        &.active:hover {
          background: #e00000;
        }
      }
    }

    .settings-page {
      position: absolute;
      inset: 0;
      background: #100c14;
      z-index: 20;
      padding: 30px;
      color: white;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      gap: 25px;
      overflow-y: auto;
    }

    .settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .settings-page h1 {
      margin: 0;
      font-size: 28px;
    }

    .settings-page .setting-item {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .settings-page label {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.8);
    }

    .settings-page select,
    .settings-page textarea {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 8px;
      padding: 12px;
      font-size: 16px;
      font-family: sans-serif;
    }

    .settings-page textarea {
      min-height: 250px;
      resize: vertical;
    }

    .settings-page select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1em;
      padding-right: 2.5rem;
    }

    .settings-page .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 15px;
      margin-top: auto;
    }

    .settings-page button {
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      cursor: pointer;
      font-size: 16px;
      padding: 12px 24px;
      transition: background-color 0.2s ease-in-out;
    }

    .settings-page button:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .settings-page button.primary {
      background: #3b82f6;
      border-color: #3b82f6;
    }
    .settings-page button.primary:hover {
      background: #2563eb;
    }

    .intro-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      backdrop-filter: blur(5px);
    }

    .intro-overlay {
      background: #1e1a24;
      color: white;
      padding: 30px;
      border-radius: 12px;
      max-width: 450px;
      width: 90%;
      text-align: center;
      font-family: sans-serif;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .intro-overlay h2 {
      margin-top: 0;
      font-size: 24px;
      color: #e0e0e0;
    }

    .intro-overlay p {
      line-height: 1.6;
      color: #b0b0b0;
      margin-bottom: 20px;
    }

    .intro-overlay button {
      outline: none;
      border: none;
      color: white;
      border-radius: 8px;
      background: #3b82f6;
      cursor: pointer;
      font-size: 16px;
      padding: 12px 24px;
      transition: background-color 0.2s ease-in-out;
      font-weight: bold;
      width: 100%;
    }

    .intro-overlay button:hover {
      background: #2563eb;
    }

    .dynamic-content-container {
      position: absolute;
      bottom: 25vh;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      max-width: 80%;
      max-height: 40vh;
      overflow-y: auto;
      padding: 10px;
    }

    .search-result-link {
      display: block;
      background: rgba(255, 255, 255, 0.1);
      color: #f0f0f0;
      padding: 8px 16px;
      border-radius: 16px;
      text-decoration: none;
      font-family: sans-serif;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      transition: background-color 0.2s ease-in-out;
    }

    .search-result-link:hover {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .generated-image {
      max-width: 100%;
      max-height: 25vh;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .download-link {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.1);
      color: #f0f0f0;
      padding: 8px 16px;
      border-radius: 16px;
      text-decoration: none;
      font-family: sans-serif;
      font-size: 14px;
      transition: background-color 0.2s ease-in-out;
    }

    .download-link:hover {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .download-link svg {
      width: 20px;
      height: 20px;
    }

    .status-indicator {
      background: rgba(255, 255, 255, 0.1);
      color: #f0f0f0;
      padding: 8px 16px;
      border-radius: 16px;
      font-family: sans-serif;
      font-size: 14px;
    }
  `;

  constructor() {
    super();
    if (localStorage.getItem('hasSeenIntro') !== 'true') {
      this.showIntroOverlay = true;
    }
    this.initClient();
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;

    // Create audio processing nodes for output enhancement
    this.compressorNode = this.outputAudioContext.createDynamicsCompressor();
    this.voiceClarityEQ = this.outputAudioContext.createBiquadFilter();
    this.lowCutEQ = this.outputAudioContext.createBiquadFilter();

    // Configure compressor for voice presence
    this.compressorNode.threshold.setValueAtTime(
      -50,
      this.outputAudioContext.currentTime,
    );
    this.compressorNode.knee.setValueAtTime(
      40,
      this.outputAudioContext.currentTime,
    );
    this.compressorNode.ratio.setValueAtTime(
      12,
      this.outputAudioContext.currentTime,
    );
    this.compressorNode.attack.setValueAtTime(
      0,
      this.outputAudioContext.currentTime,
    );
    this.compressorNode.release.setValueAtTime(
      0.25,
      this.outputAudioContext.currentTime,
    );

    // Configure EQ for voice clarity (boost presence range)
    this.voiceClarityEQ.type = 'peaking';
    this.voiceClarityEQ.frequency.setValueAtTime(
      2500,
      this.outputAudioContext.currentTime,
    );
    this.voiceClarityEQ.gain.setValueAtTime(
      3.0,
      this.outputAudioContext.currentTime,
    );
    this.voiceClarityEQ.Q.setValueAtTime(
      1.5,
      this.outputAudioContext.currentTime,
    );

    // Configure EQ to cut low-end rumble
    this.lowCutEQ.type = 'highpass';
    this.lowCutEQ.frequency.setValueAtTime(
      80,
      this.outputAudioContext.currentTime,
    );

    // Chain the audio nodes: Compressor -> Low-cut -> Clarity EQ -> Visualizer/Output
    this.compressorNode.connect(this.lowCutEQ);
    this.lowCutEQ.connect(this.voiceClarityEQ);
    this.voiceClarityEQ.connect(this.outputNode);
  }

  private async initClient() {
    this.initAudio();

    this.client = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });

    this.outputNode.connect(this.outputAudioContext.destination);

    this.initSession();
  }

  private async sendWhatsAppMessage(to: string, text: string) {
    const wasenderToken =
      'a93130a37456424664c6872066f5c52ec7d178404831e74ee13e945682898ae8';

    try {
      const response = await fetch('https://wasenderapi.com/api/send-message', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${wasenderToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({to, text}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WhatsApp API error:', errorText);
        return {
          success: false,
          error: `API request failed with status ${response.status}: ${errorText}`,
        };
      }

      const responseData = await response.json();
      return {success: true, data: responseData};
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return {success: false, error: (error as Error).message};
    }
  }

  private async initSession() {
    const model = 'gemini-2.5-flash';

    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn) {
              const modelTurn = message.serverContent.modelTurn;

              if (modelTurn.parts) {
                for (const part of modelTurn.parts) {
                  if (part.inlineData) {
                    const audio = part.inlineData;
                    // Decode first to get the buffer.
                    const audioBuffer = await decodeAudioData(
                      decode(audio.data),
                      this.outputAudioContext,
                      24000,
                      1,
                    );

                    // Then, calculate the next start time, accounting for any
                    // decoding latency.
                    this.nextStartTime = Math.max(
                      this.nextStartTime,
                      this.outputAudioContext.currentTime,
                    );

                    const source =
                      this.outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(this.compressorNode);
                    source.addEventListener('ended', () => {
                      this.sources.delete(source);
                    });

                    // Schedule playback and update the start time for the
                    // subsequent chunk.
                    source.start(this.nextStartTime);
                    this.nextStartTime += audioBuffer.duration;
                    this.sources.add(source);
                  } else if (part.functionCall) {
                    const functionCall = part.functionCall;
                    if (functionCall.name === 'sendWhatsAppMessage') {
                      // FIX: Cast functionCall.args to prevent type errors.
                      const {to, text} = functionCall.args as {
                        to: string;
                        text: string;
                      };
                      this.updateStatus(`Sending WhatsApp to ${to}...`);
                      const result = await this.sendWhatsAppMessage(to, text);
                      // FIX: Corrected property from 'toolResponses' to 'toolResponse' to match the expected API.
                      this.session.sendRealtimeInput({
                        toolResponse: {
                          functionResponses: [
                            {
                              name: functionCall.name,
                              response: result,
                            },
                          ],
                        },
                      });
                      this.updateStatus(
                        result.success
                          ? `WhatsApp message sent to ${to}.`
                          : `Failed to send WhatsApp message.`,
                      );
                    } else if (functionCall.name === 'createDocument') {
                      // FIX: Cast functionCall.args to prevent type errors.
                      const {fileName, content} = functionCall.args as {
                        fileName: string;
                        content: string;
                      };
                      this.updateStatus(`Creating document: ${fileName}`);
                      const result = this.createDownloadableFile(
                        fileName,
                        content,
                      );
                      // FIX: Corrected property from 'toolResponses' to 'toolResponse' to match the expected API.
                      this.session.sendRealtimeInput({
                        toolResponse: {
                          functionResponses: [
                            {
                              name: functionCall.name,
                              response: result,
                            },
                          ],
                        },
                      });
                      this.updateStatus(
                        result.success
                          ? `Document ${fileName} is ready for download.`
                          : `Failed to create document.`,
                      );
                    }
                  } else if (part.text) {
                    // Check for draw command
                    const drawRegex = /<draw>(.*?)<\/draw>/s;
                    const drawMatch = part.text.match(drawRegex);

                    if (drawMatch && drawMatch[1]) {
                      const imagePrompt = drawMatch[1].trim();
                      this.generateImage(imagePrompt);
                      // remove the tag from the text to be displayed
                      part.text = part.text.replace(drawRegex, '').trim();
                    }

                    if (part.text) {
                      this.modelResponseText += part.text;
                      this.updateStatus(this.modelResponseText);
                    }
                  }
                }
              }

              if (message.serverContent.groundingMetadata?.groundingChunks) {
                const newResults =
                  message.serverContent.groundingMetadata.groundingChunks
                    .filter((chunk) => chunk.web && chunk.web.uri)
                    .map((chunk) => ({
                      uri: chunk.web!.uri,
                      title: chunk.web!.title || chunk.web!.uri,
                    }));

                if (newResults.length > 0) {
                  const currentUris = new Set(
                    this.searchResults.map((r) => r.uri),
                  );
                  const uniqueNewResults = newResults.filter(
                    (r) => !currentUris.has(r.uri),
                  );
                  if (uniqueNewResults.length > 0) {
                    this.searchResults = [
                      ...this.searchResults,
                      ...uniqueNewResults,
                    ];
                  }
                }
              }
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
              this.modelResponseText = '';
            }
          },
          // FIX: The onerror callback expects an ErrorEvent, not an Error.
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close:' + e.reason);
          },
        },
        config: {
          systemInstruction: this.systemInstruction,
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {voiceName: this.selectedVoice},
            },
          },
          tools,
        },
      });
    } catch (e) {
      this.updateError((e as Error).message);
      console.error(e);
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
    this.error = '';
  }

  private updateError(msg: string) {
    this.error = msg;
    this.status = '';
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }
    this.vadState = 'silent';
    this.silenceFramesCount = 0;
    this.modelResponseText = '';
    this.searchResults = [];
    this.generatedImageUrl = null;
    this.downloadableFiles = [];
    this.inputAudioContext.resume();
    this.outputAudioContext.resume();

    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.updateStatus('Microphone access granted. Starting capture...');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        // VAD Logic
        const rms = Math.sqrt(
          pcmData.reduce((sum, val) => sum + val * val, 0) / pcmData.length,
        );

        if (rms > this.VAD_THRESHOLD) {
          this.vadState = 'speaking';
          this.silenceFramesCount = 0;
        } else if (this.vadState === 'speaking') {
          this.silenceFramesCount++;
          if (this.silenceFramesCount > this.VAD_HANGOVER_FRAMES) {
            this.vadState = 'silent';
          }
        }

        if (this.vadState === 'speaking') {
          this.session.sendRealtimeInput({media: createBlob(pcmData)});
        }
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.updateStatus('🔴 Recording... Capturing PCM chunks.');
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateStatus(`Error: ${(err as Error).message}`);
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.updateStatus('Stopping recording...');

    this.isRecording = false;

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.updateStatus('Recording stopped. Click Start to begin again.');
  }

  private reset() {
    this.session?.close();
    this.initSession();
    this.updateStatus('Session cleared.');
    this.modelResponseText = '';
    this.searchResults = [];
    this.generatedImageUrl = null;
    this.downloadableFiles = [];
  }

  private createDownloadableFile(fileName: string, content: string) {
    try {
      const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const newFiles = [...this.downloadableFiles, {name: fileName, url}];
      if (newFiles.length > 5) {
        const oldestFile = newFiles.shift();
        if (oldestFile) {
          URL.revokeObjectURL(oldestFile.url);
        }
      }
      this.downloadableFiles = newFiles;
      return {success: true, fileName};
    } catch (error) {
      console.error('Error creating file:', error);
      this.updateError(`Failed to create ${fileName}`);
      return {success: false, error: (error as Error).message};
    }
  }

  private async generateImage(prompt: string) {
    this.isGeneratingImage = true;
    this.generatedImageUrl = null;
    this.updateStatus('Generating image...');
    try {
      const response = await this.client.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '9:16',
        },
      });

      const base64ImageBytes: string =
        response.generatedImages[0].image.imageBytes;
      this.generatedImageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
      this.updateStatus('Image generated.');
    } catch (e) {
      this.updateError((e as Error).message);
      console.error(e);
    } finally {
      this.isGeneratingImage = false;
    }
  }

  private disconnectSession() {
    this.stopRecording();
    this.reset();
  }

  private handleSettingsClick() {
    this.currentView = 'settings';
  }

  private handleBackClick() {
    this.currentView = 'main';
    this.tempSystemInstruction = this.systemInstruction;
  }

  private handleVoiceChange(e: Event) {
    this.selectedVoice = (e.target as HTMLSelectElement).value;
  }

  private handleSystemInstructionChange(e: Event) {
    this.tempSystemInstruction = (e.target as HTMLTextAreaElement).value;
  }

  private saveSettings() {
    this.systemInstruction = this.tempSystemInstruction;
    this.disconnectSession();
    this.currentView = 'main';
    this.updateStatus('Settings updated. Session restarted.');
  }

  private dismissIntroOverlay() {
    this.showIntroOverlay = false;
    localStorage.setItem('hasSeenIntro', 'true');
  }

  private renderIntroOverlay() {
    if (!this.showIntroOverlay) {
      return null;
    }
    return html`
      <div class="intro-backdrop">
        <div class="intro-overlay">
          <h2>Welcome to Live Voice Chat!</h2>
          <p>
            This is a real-time voice conversation with an AI assistant. The
            rings of light visualize your voice and the AI's responses.
          </p>
          <p>
            Press the <strong>Start</strong> button to begin the conversation,
            and <strong>Close Now</strong> to end the session.
          </p>
          <button @click=${this.dismissIntroOverlay}>Got It!</button>
        </div>
      </div>
    `;
  }

  private renderMainView() {
    return html`
      <div>
        <div class="settings-container">
          <button
            id="settingsButton"
            aria-label="Settings"
            @click=${this.handleSettingsClick}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 0 24 24"
              width="24px">
              <path d="M0 0h24v24H0V0z" fill="none" />
              <path
                d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
            </svg>
          </button>
        </div>

        <div class="dynamic-content-container">
          ${this.searchResults.map(
            (result) => html`
              <a
                href=${result.uri}
                target="_blank"
                rel="noopener noreferrer"
                class="search-result-link">
                ${result.title}
              </a>
            `,
          )}
          ${this.isGeneratingImage
            ? html`<div class="status-indicator">Generating image...</div>`
            : ''}
          ${this.generatedImageUrl
            ? html`<img
                src=${this.generatedImageUrl}
                class="generated-image"
                alt="Generated by AI" />`
            : ''}
          ${this.downloadableFiles.map(
            (file) => html`
              <a href=${file.url} download=${file.name} class="download-link">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 0 24 24"
                  width="24px"
                  fill="#FFFFFF">
                  <path d="M0 0h24v24H0V0z" fill="none" />
                  <path
                    d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
                <span>${file.name}</span>
              </a>
            `,
          )}
        </div>

        <div class="controls">
          <button
            id="controlButton"
            class=${this.isRecording ? 'active' : ''}
            @click=${
              this.isRecording ? this.disconnectSession : this.startRecording
            }>
            ${this.isRecording ? 'Close Now' : 'Start'}
          </button>
        </div>

        <div id="status"> ${this.status || this.error} </div>
        <gdm-live-audio-visuals
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals>
      </div>
    `;
  }

  private renderSettingsView() {
    return html`
      <div class="settings-page">
        <div class="settings-header">
          <h1>Settings</h1>
        </div>

        <div class="setting-item">
          <label for="voice-select">Voice</label>
          <select
            id="voice-select"
            .value=${this.selectedVoice}
            @change=${this.handleVoiceChange}>
            ${availableVoices.map(
              (voice) =>
                html`<option value=${voice.name}>${voice.alias}</option>`,
            )}
          </select>
        </div>

        <div class="setting-item">
          <label for="system-prompt">Assistant Persona</label>
          <textarea
            id="system-prompt"
            .value=${this.tempSystemInstruction}
            @input=${this.handleSystemInstructionChange}></textarea>
        </div>

        <div class="buttons">
          <button @click=${this.handleBackClick}>Cancel</button>
          <button class="primary" @click=${this.saveSettings}
            >Save and Restart</button
          >
        </div>
      </div>
    `;
  }

  render() {
    if (this.currentView === 'settings') {
      return this.renderSettingsView();
    }
    return html` ${this.renderMainView()} ${this.renderIntroOverlay()} `;
  }
}