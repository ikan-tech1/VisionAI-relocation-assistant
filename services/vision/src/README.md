# Vision Service

This folder is reserved for production-grade computer vision adapters.

For this initial implementation, vision inference is wired inside the web API layer with a deterministic mock model so the product workflow is testable end-to-end:

- accepts sampled video frames
- predicts likely room items
- returns confidence + rough dimensions
- supports dedupe with temporal tracking

When replacing with a real model provider, keep the response contract stable.
