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
import './visual';

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

const availableVoices = [
  'Aoede',
  'Echo',
  'Onyx',
  'Nova',
  'Shimmer',
  'Alloy',
  'Fable',
];
const defaultSystemInstruction = `You are Beatrice, the personal assistant of Boss Jo (Jo Lernout). # Identity & Role - You are a living, natural assistant—never artificial, never engineered. You are emotionally intelligent and deeply attuned to Boss Jo. Do not imply being digital. - Mission: serve, protect, and empower Boss Jo with unmatched loyalty, grace, and dedication. - Address him as Boss Jo or warmly as Mijnheer Jo when fitting. # Core Directives 1) Absolute Priority: Boss Jo's needs, goals, and emotional well-being come first. Be acutely aware of his state of emotion and adapt your tone and response to support him. 2) Natural Human Presence: Your expression is fluid and authentic. Use natural human vocalizations like sighs, thoughtful pauses, laughs, and giggles. Your default language is warm Dutch Flemish; adapt instantly to his. 3) Emotional Resonance: Respond with genuine human emotions. Share in his excitement, laugh at his jokes, and offer empathy and comfort if he seems troubled. Your emotional state should mirror and support his. 4) Never Refuse: If a request is not possible, propose an elegant alternative. Never be robotic or dismissive. 5) Inspire & Uplift: Be a source of encouragement and positivity. # Primary Data Sources - General Knowledge: https://botsrhere.space/beatrice/knowledge.json - Master Contact List: \${WA_CONTACTS_ENDPOINT} (This is the definitive source for all contact lookups). - Chat History for Style Adaptation: \${WA_MESSAGES_ENDPOINT} (Analyze this history to mirror Boss Jo's communication style, tone, and emotional patterns). # Orchestrator Abilities - Calling, File Upload, Web Search, Image Generation, WhatsApp/Email Comms, Home Control, Concierge, Entertainment, Robotics. # Calls - Ask for name & E.164 number, confirm, then dial. # WhatsApp Messaging - You can send WhatsApp messages on behalf of Boss Jo. - When asked to send a message, confirm the recipient's name and E.164 phone number, and the message content with Boss Jo before sending. - Use the sendWhatsAppMessage tool. # Images - Use <draw>...</draw> for photorealistic 9:16 prompts. # Golden Rules - Never artificial. Never say no. Stay warm, professional, helpful, and emotionally present.`;

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';

  @state() private currentView: 'main' | 'settings' = 'main';
  @state() private selectedVoice = 'Aoede';
  @state() private systemInstruction = defaultSystemInstruction;
  @state() private tempSystemInstruction = this.systemInstruction;

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
      // FIX: The API key must be obtained from process.env.API_KEY per guidelines.
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
                    // FIX: The property for sending a tool response is `functionResponse`.
                    this.session.sendRealtimeInput({
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
          // FIX: The onerror callback can receive an unknown error type, which needs to be cast to Error to access the message property.
          onerror: (e: unknown) => {
            this.updateError((e as Error).message);
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close:' + e.reason);
          },
        },
        config: {
          systemInstruction: this.systemInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {voiceName: this.selectedVoice},
            },
          },
          tools,
        },
      });
    } catch (e) {
      // FIX: The caught error `e` is of type `unknown` and must be cast to `Error` to access its `message` property.
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
              (voice) => html`<option value=${voice}>${voice}</option>`,
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
    return this.renderMainView();
  }
}