# Avatar System

## Organization

Avatar and scene code lives in `client/src/components/Scene/`.

Important files:

- `AgentScene.tsx`: creates the React Three Fiber `Canvas`, camera, controls, environment, face model, waveforms, and workspace ring.
- `FaceModel.tsx`: loads the face GLB, applies hologram materials, morph targets, expression blending, gestures, head motion, attention rotations, and state colors.
- `morphTargets.ts`: helpers for morph target meshes.
- `createHologramMaterial.ts`: custom material factory used by the avatar.
- `VoiceWaveform.tsx`: visual voice/state waveform.
- `AIBrain.tsx`: brain/visual effect inside the face scene.
- `FuturisticEnvironment.tsx`: scene lighting/environment.
- `WorkspaceRing.tsx` and `WorkspaceSlot.tsx`: spatial artifact display around the avatar.
- `SpatialObjectDisplay.tsx`: close display for the current object. To be confirmed: this component exists but is not currently rendered by `AgentScene.tsx`.

Public assets:

- `client/public/models/facecap.glb`
- `client/public/models/file.glb`
- `client/public/basis/*` for KTX2 transcoding
- `client/public/hdri/*`

## 3D Scene Flow

1. `App.tsx` renders `<AgentScene facialExpression={facialExpression} />`.
2. `AgentScene` creates a `Canvas` with the initial camera position.
3. `FaceModel` loads `/models/facecap.glb` with Drei `useGLTF`.
4. Face meshes get hologram materials.
5. `useFrame` in `FaceModel` updates materials, morph targets, mouth movement, head motion, gestures, attention, and position.
6. `WorkspaceRing` appears only when agent state is `inspecting` or `ready`.

## Facial Expressions

Facial expression definitions live in `client/src/constants/Expressions.ts`.

Current expression names:

- `neutral`
- `happy`
- `sad`
- `angry`
- `bored`
- `listening`
- `thinking`
- `confused`

Each expression maps morph target names to influence values. `FACIAL_EXPRESSION_MORPH_TARGETS` is derived from all configured expression target names.

Important rules:

- Only use morph target names present in the GLB mesh dictionaries.
- Keep values in a reasonable `0` to `1` range unless intentionally exaggerating.
- Update `FacialExpressionName` and `FACIAL_EXPRESSIONS` together.
- If backend can emit a new emotion, update server `DetectedEmotion`, keyword detection, client API response types, `AgentEmotion`, and expression mappings as needed.

## Gestures

Current gesture type:

- `none`
- `wink`

Flow:

1. Backend detects gesture keywords in `detectGesture`.
2. Response includes `gesture`.
3. `ChatWindow` calls `triggerGesture`.
4. `FaceModel` observes `gesture` from `useAgentStore`.
5. For `wink`, `FaceModel` animates wink amount and head tilt over about 1.1 seconds.
6. `FaceModel` calls `clearGesture` when the gesture finishes.

Rules for adding gestures:

- Update `AgentGesture` in `client/src/stores/agentStore.ts`.
- Update API response types in `client/src/services/api.ts`.
- Update backend `DetectedGesture`, keyword map, and `detectGesture`.
- Add the animation in `FaceModel` without introducing per-frame React state updates.
- Ensure gestures reset themselves through `clearGesture`.

## Speaking States And Mouth Movement

Main state source: `client/src/stores/agentStore.ts`.

- `setSpeaking(true)` sets `isSpeaking: true`, `state: "speaking"`, and resets `mouthOpen`.
- `setSpeaking(false)` sets `isSpeaking: false`, resets `mouthOpen`, and returns to `afterSpeakingState` or `idle`.
- `afterSpeakingState` is used after object analysis or generated artifact display to return to `ready` or `inspecting`.
- `playAudioWithVolume` in `client/src/services/audio.ts` analyzes Web Audio RMS and calls `setMouthOpen`.
- `FaceModel` uses `mouthOpen` to drive mouth movement and visual intensity while speaking.

## Agent States And Visuals

Agent states are defined in `client/src/stores/agentStore.ts`:

- `idle`
- `listening`
- `inspecting`
- `thinking`
- `ready`
- `speaking`

State visuals are defined in `client/src/constants/stateVisuals.ts` and `FaceModel.tsx`.

When adding a new state:

- Update `AgentState`.
- Update `STATE_VISUALS`.
- Update `FACE_STATE_VISUALS`.
- Audit UI conditions checking state names, especially `WorkspaceRing`, `SpatialObjectDisplay`, `WorkspaceNavigation`, controls-disabled logic, and chat flow return states.

## Attention Targeting

`FaceModel` uses `ATTENTION_ROTATIONS` keyed by `AgentAttentionTarget`:

- `none`
- `chatInput`
- `sendButton`
- `voiceButton`
- `chatPanel`
- `spatialObject`

`ChatWindow` nudges attention when users focus/type/click chat controls.

## Performance Warnings

- Do not call React `setState` inside `useFrame` loops.
- Use refs for frame-local animation state.
- Memoize materials/loaders where possible.
- Dispose custom materials and helpers in cleanup effects.
- Avoid traversing large scene graphs every frame unless necessary.
- Do not recreate GLTF scenes or textures during normal state changes.
- Keep Zustand subscriptions scoped to the values a component actually needs.
