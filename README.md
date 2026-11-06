# Pixel Perfect

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mws-school.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/594a3d00-11ef-496c-8564-0abf9db2d55d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Optional teacher invitation emails

Admins can always copy and share an invitation link. To send it directly, enable **Send the invitation to this email using Resend** on the staff page.

Configure these values in .env.local before deploying the Neon Function:

- RESEND_API_KEY: your Resend API key
- RESEND_FROM_EMAIL: a sender address on your verified Resend domain, such as Shule Yetu <invites@your-domain.example>
- SHULE_YETU_APP_URL: your deployed app origin, such as https://shule-yetu-two.vercel.app

Verify the sender domain in Resend first. These are server-side Neon Function settings; do not prefix them with VITE_ or add the Resend API key to browser code. Deploy them with neon deploy --env .env.local. If email settings are missing or Resend rejects the message, the invitation is still created and the admin can copy the link.

