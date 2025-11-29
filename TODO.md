# TODO: Implement Profile Picture Uploads for Users and Admins

## Step 1: Install Dependencies
- Install multer package for file uploads.

## Step 2: Update Database Schema
- Add `profile_picture` TEXT column to the `users` table in `server.js`.

## Step 3: Create Upload Directory
- Create `public/uploads` directory for storing profile pictures.

## Step 4: Configure Multer in server.js
- Add multer configuration for profile picture uploads (file type validation, size limits, unique naming).

## Step 5: Add Routes in server.js
- POST `/upload-profile-picture`: Handle file upload, save to server, update DB, delete old file.
- POST `/delete-profile-picture`: Delete file from server, set DB field to NULL.

## Step 6: Update user.ejs
- Add section to display current profile picture (if exists).
- Add form to upload new profile picture.
- Add button to delete current profile picture.

## Step 7: Update admin.ejs
- Add section to display current profile picture (if exists).
- Add form to upload new profile picture.
- Add button to delete current profile picture.

## Step 8: Handle User Deletion
- Ensure when a user is deleted (future route), the profile picture file is also deleted.

## Step 9: Test Functionality
- Test uploading, changing, and deleting profile pictures for both user and admin roles.
