
Step-by-Step Guide to Push Your V2 Folder


1. Keep Your Local Root Clean

1. Place all original repository files at the root of your project folder (not inside a V1 folder), right alongside the hidden .git folder.
2. Put your new version inside a V2 folder at that exact same root level.
3. Check git status in your terminal. You should only see V2/ listed under Untracked files—none of the original files should show as deleted or renamed.

2. Push on a New Branch (Safest Collaborator Practice)

Even when you have direct push access, pushing your new folder to a dedicated branch prevents accidental conflicts on main:
1. Create and switch to a new branch. Run git checkout -b add-v2.
2. Stage only your V2 folder. Run git add V2/ so you only upload your new version.
3. Commit your changes. Run git commit -m "Add V2 version of the program".
4. Push directly to the repository. Run git push -u origin add-v2.

3. Merge Into main (If Ready)

• Via Pull Request (Recommended): Open the repository in your browser and click Compare & pull request to review your V2 folder cleanly before merging it into main.
• Direct Merge: If your team pushes straight to main, run git checkout main, then git merge add-v2, and finally git push origin main.