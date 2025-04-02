# Time Travel Guide: Checking Old Code Versions Safely

This guide explains how to temporarily look at an older version of the code and then return to your current work without breaking things.

**Goal:** Look at old code, then come back safely.

---

## Part 1: Before You Go Back

1.  **Save Your Current Work:**
    *   Go to the "Source Control" panel (the icon with branching lines).
    *   **Option A (Commit):** If you want to save your changes permanently, enter a message (like "WIP before time travel") and click "Commit".
    *   **Option B (Stash):** If you want to save changes temporarily:
        *   Click the "..." menu at the top of the Source Control panel.
        *   Choose "Stash" -> "Stash (Include Untracked)". This hides your changes safely.
2.  **Remember Your Branch:** Note the name of the branch you are currently working on (it's usually shown at the bottom-left of the editor).
3.  **Tell the AI:** Say, "Okay, I saved my work on branch `[your-branch-name]`. I'm going to look at old code version `[commit description or number]` now."

---

## Part 2: Looking at the Old Code

4.  **Get the Old Code:**
    *   In the terminal, type: `git checkout [commit number or tag]`
5.  **Tell the AI:** Say, "Okay, I'm now looking at `[commit description or number]`."
6.  **Restart the App (IMPORTANT!):**
    *   In the terminal, type: `docker-compose down && docker-compose up -d`
    *   Wait for it to finish. This makes sure the running app matches the old code.
7.  **Investigate:** Look at the old code and test the app as needed.

---

## Part 3: Coming Back to Your Branch

8.  **Tell the AI:** Say, "Right, I'm done looking at the old code. Let's go back to branch `[your-branch-name]`."
9.  **Get Your Branch Code Back:**
    *   In the terminal, type: `git checkout [your-branch-name]` (Use the branch name you noted in Step 2).
10. **Tell the AI:** Say, "Okay, I'm back on the `[your-branch-name]` branch now."
11. **Restart the App AGAIN (IMPORTANT!):**
    *   In the terminal, type: `docker-compose down && docker-compose up -d`
    *   Wait for it to finish. This makes sure the running app matches your latest code again.
12. **Get Your Saved Work Back (If you stashed):**
    *   Go to the "Source Control" panel.
    *   Click the "..." menu.
    *   Choose "Stash" -> "Pop Stash". Your temporarily saved changes should reappear.

---

**You're back!** Your code and running app should now be back to where you were before the time travel. 