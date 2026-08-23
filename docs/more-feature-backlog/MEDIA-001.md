# MEDIA-001 — Make Excalidraw a first-class, recoverable workspace object

Status: experimental metadata foundation.

## Before change

Example: an `.excalidraw` document persisted drawing data but had no stable title, tags, backlinks, project link, or asset ID metadata in the file document.

## After change

Stored Excalidraw documents normalize optional metadata for title, tags, backlinks, project ID, and asset IDs. The editor loads a title fallback from the path and preserves metadata on atomic saves, while existing backup recovery remains intact.

## Verification

Excalidraw file parsing and existing file-service recovery tests pass. Search/export UI for drawing metadata is a later integration step.
