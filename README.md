# OSRS Character Planner

## Run locally
Run `python server.py` and visit http://localhost:8000.

## Deploy to Vercel
Upload all files and the `api` folder to a GitHub repository, then import that repository into Vercel. Choose **Other** as framework preset and leave the build command empty. The root `index.html` is static and `api/index.py` is a Flask serverless function.

The OSRS Hiscores and OSRS Wiki are external services; they may occasionally reject or time out on requests from cloud hosts. Character goals and completed quests are stored in each browser's local storage, not shared across users.
