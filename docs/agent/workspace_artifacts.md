# Workspace Artifacts

## Representation

There are two related client stores:

`client/src/stores/SpatialObjectStore.ts`

- Tracks the current close-focus object.
- Type: `SpatialObject`.
- Kinds: `image`, `pdf`, `text`.
- Status: `empty`, `uploading`, `inspecting`, `thinking`, `ready`, `error`.

`client/src/stores/workspaceStore.ts`

- Tracks all workspace objects for ring navigation.
- Type: `WorkspaceObject`.
- Types: `image`, `pdf`, `code`, `text`, `unknown`.
- Tracks `activeObjectId` and `activeIndex`.

Generated chat attachments use:

```ts
{
  fileName: string;
  mimeType: string;
  data: string; // base64
}
```

## Uploaded Files

Upload UI:

- Component: `client/src/components/SpatialObject/ObjectDropZone.tsx`
- API client: `uploadObject` in `client/src/services/api.ts`
- Backend route: `POST /api/ai/object`
- Multipart field name: `object`

Client behavior:

- Creates a local object ID.
- Creates an image preview with `URL.createObjectURL(file)` for images.
- Adds object to both spatial and workspace stores.
- Sets agent state to `inspecting`.
- Sends file to backend.
- Updates stores with analysis result and backend object ID.
- Deletes/clears object through `DELETE /api/ai/object`.

Server behavior:

- Uses Multer temporary upload directory `uploads/`.
- Supports images, PDFs, and text/code/markdown extensions.
- Deletes temporary uploaded file in `finally` or error cleanup.
- Stores object summary in in-memory conversation context.

## Generated Files

Generated artifacts are created by chat or voice routes.

Server creation:

- Text-like files: `Buffer.from(content, "utf8").toString("base64")`.
- PDFs: rendered with PDFKit and returned as base64.
- Images: generated with OpenAI Images API and returned as base64.

Client handling:

- `ChatWindow` displays a `ChatAttachmentLink`.
- `attachmentToDownloadUrl` converts base64 into a Blob URL.
- `ChatAttachmentLink` revokes the Blob URL when the attachment changes/unmounts.
- `displayAttachmentInWorkspace` creates a Blob, object URL, spatial object, and workspace object.

## Downloads

Downloads are browser-side:

- Base64 attachment data is decoded with `atob`.
- A `Blob` is created using the attachment MIME type.
- `URL.createObjectURL(blob)` creates a download URL.
- The anchor uses `download={attachment.fileName}`.

Do not expose server filesystem paths to the client.

## Workspace Display

Workspace ring:

- `WorkspaceRing` renders when agent state is `inspecting` or `ready`.
- It maps `workspaceStore.objects` into `WorkspaceSlot` components around a ring.
- The active object rotates to the front.
- Images use texture previews.
- Non-images use `/models/file.glb`.
- Arrow buttons and keyboard left/right navigation live in `WorkspaceNavigation`.

Close spatial display:

- `SpatialObjectDisplay` can display image previews or the file GLB plus a label.
- To be confirmed: it is not currently mounted in `AgentScene.tsx`.

## Add A New Artifact Type Safely

Checklist:

- Server: add MIME/extension handling in `server/src/routes/ai.routes.ts`.
- Server: ensure the new type is safe to read, parse, and pass to OpenAI.
- Server: cap content size for text-like formats.
- Client: update `ObjectDropZone` `accept` attribute.
- Client: update `getKind` if it belongs in `SpatialObjectKind`.
- Client: update `getWorkspaceType` in both `ObjectDropZone` and `ChatWindow` if generated artifacts can use it.
- Client: update preview/display logic in `WorkspaceSlot` or `SpatialObjectDisplay`.
- Types: update `SpatialObjectKind` or `WorkspaceObjectType`.
- Docs: update `AGENTS.md`, architecture, and this file.
- Checks: run frontend and backend builds.

## Security Notes

- Treat all uploaded files as untrusted.
- Do not execute uploaded code.
- Do not serve raw uploaded files from the temporary upload directory.
- Delete temporary server files after processing.
- Revoke object URLs when no longer needed.
- Do not log base64 file data or full file contents.
- Avoid adding support for binary formats unless there is a clear analysis strategy and size limits.
- Preserve demo-token checks on upload and generation routes.
