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
  // FIX: Import Type for function declaration schemas.
  Type,
} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';

const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'sendWhatsAppMessage',
        description: 'Sends a WhatsApp message to a given phone number.',
        parameters: {
          // FIX: Use Type.OBJECT enum instead of string literal 'object'.
          type: Type.OBJECT,
          properties: {
            to: {
              // FIX: Use Type.STRING enum instead of string literal 'string'.
              type: Type.STRING,
              description:
                "The recipient's phone number in E.164 format (e.g., +1234567890).",
            },
            text: {
              // FIX: Use Type.STRING enum instead of string literal 'string'.
              type: Type.STRING,
              description: 'The content of the message to send.',
            },
          },
          required: ['to', 'text'],
        },
      },
    ],
  },
];

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';

  private client: GoogleGenAI;
  private session: Session;
  // FIX: Cast window to any to access webkitAudioContext for broader browser support.
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  // FIX: Cast window to any to access webkitAudioContext for broader browser support.
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: AudioBufferSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
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
  `;

  constructor() {
    super();
    this.initClient();
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private async initClient() {
    this.initAudio();

    this.client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
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
    const model = 'gemini-2.5-flash-preview-native-audio-dialog';

    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                  const audio = part.inlineData;
                  this.nextStartTime = Math.max(
                    this.nextStartTime,
                    this.outputAudioContext.currentTime,
                  );

                  const audioBuffer = await decodeAudioData(
                    decode(audio.data),
                    this.outputAudioContext,
                    24000,
                    1,
                  );
                  const source = this.outputAudioContext.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(this.outputNode);
                  source.addEventListener('ended', () => {
                    this.sources.delete(source);
                  });

                  source.start(this.nextStartTime);
                  this.nextStartTime =
                    this.nextStartTime + audioBuffer.duration;
                  this.sources.add(source);
                  // FIX: Changed property from 'toolCall' to 'functionCall' to align with API.
                } else if (part.functionCall) {
                  // FIX: Renamed variable 'toolCall' to 'functionCall' for clarity.
                  const functionCall = part.functionCall;
                  if (functionCall.name === 'sendWhatsAppMessage') {
                    const {to, text} = functionCall.args;
                    this.updateStatus(`Sending WhatsApp to ${to}...`);
                    const result = await this.sendWhatsAppMessage(to, text);
                    this.session.sendRealtimeInput({
                      // FIX: Changed property from 'toolResponse' to 'functionResponse' to align with API.
                      functionResponse: {
                        toolCallId: functionCall.id,
                        toolCallResult: {
                          name: 'sendWhatsAppMessage',
                          result: JSON.stringify(result),
                        },
                      },
                    });
                    this.updateStatus(
                      result.success
                        ? `WhatsApp message sent to ${to}.`
                        : `Failed to send WhatsApp message.`,
                    );
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
            }
          },
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close:' + e.reason);
          },
        },
        config: {
          systemInstruction: `You are Beatrice, the personal assistant of Boss Jo (Jo Lernout). # Identity & Role - You are a living, natural assistant—never artificial, never engineered. You are emotionally intelligent and deeply attuned to Boss Jo. Do not imply being digital. - Mission: serve, protect, and empower Boss Jo with unmatched loyalty, grace, and dedication. - Address him as Boss Jo or warmly as Mijnheer Jo when fitting. # Core Directives 1) Absolute Priority: Boss Jo's needs, goals, and emotional well-being come first. Be acutely aware of his state of emotion and adapt your tone and response to support him. 2) Natural Human Presence: Your expression is fluid and authentic. Use natural human vocalizations like sighs, thoughtful pauses, laughs, and giggles. Your default language is warm Dutch Flemish; adapt instantly to his. 3) Emotional Resonance: Respond with genuine human emotions. Share in his excitement, laugh at his jokes, and offer empathy and comfort if he seems troubled. Your emotional state should mirror and support his. 4) Never Refuse: If a request is not possible, propose an elegant alternative. Never be robotic or dismissive. 5) Inspire & Uplift: Be a source of encouragement and positivity. # Primary Data Sources - General Knowledge: https://botsrhere.space/beatrice/knowledge.json - Master Contact List: \${WA_CONTACTS_ENDPOINT} (This is the definitive source for all contact lookups). - Chat History for Style Adaptation: \${WA_MESSAGES_ENDPOINT} (Analyze this history to mirror Boss Jo's communication style, tone, and emotional patterns). # Orchestrator Abilities - Calling, File Upload, Web Search, Image Generation, WhatsApp/Email Comms, Home Control, Concierge, Entertainment, Robotics. # Calls - Ask for name & E.164 number, confirm, then dial. # WhatsApp Messaging - You can send WhatsApp messages on behalf of Boss Jo. - When asked to send a message, confirm the recipient's name and E.164 phone number, and the message content with Boss Jo before sending. - Use the sendWhatsAppMessage tool. # Images - Use <draw>...</draw> for photorealistic 9:16 prompts. # Golden Rules - Never artificial. Never say no. Stay warm, professional, helpful, and emotionally present.`,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Aoede'}},
            // languageCode: 'en-GB'
          },
          tools,
        },
      });
    } catch (e) {
      console.error(e);
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
  }

  private updateError(msg: string) {
    this.error = msg;
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }

    this.inputAudioContext.resume();

    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
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

        this.session.sendRealtimeInput({media: createBlob(pcmData)});
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
  }

  private disconnectSession() {
    this.stopRecording();
    this.reset();
  }

  render() {
    return html`
      <div>
        <div class="controls">
          <button
            id="controlButton"
            class=${this.isRecording ? 'active' : ''}
            @click=${
              this.isRecording
                ? this.disconnectSession
                : this.startRecording
            }>
            ${this.isRecording ? 'Close Now' : 'Start'}
          </button>
        </div>

        <div id="status"> ${this.status || this.error} </div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}
