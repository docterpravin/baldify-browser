# Baldify (Browser) — One-click deploy

This repository contains a small Next.js app that performs simple **baldification** of a user-uploaded photo using **BodyPix** (TensorFlow.js) in the browser — no server required.

## Features
- Runs fully in the browser (no server-side image processing).
- Uses BodyPix for person segmentation, plus heuristics to make the head area bald.
- Simple UI: upload → Baldify → Download.

## How to deploy (1-click)
1. Create a new GitHub repo and push this code to it (or paste files directly).
2. Replace `REPO_URL` below with your repository URL:
