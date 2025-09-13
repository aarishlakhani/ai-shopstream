# AI Shopstream - Live Interactive Shopping

🎯 **Concept**: Live AI-powered shopping experience with AI avatars hosting 24/7 product demonstrations, like QVC but AI-driven and always available.

## Features

- **Live AI Avatar Host**: Interactive AI avatar that demonstrates products and answers questions
- **Real-time Product Search**: Search and filter products with natural language
- **Multilingual Support**: English, French, Spanish, and Hindi
- **Shopify Integration**: Connect to real Shopify stores via Storefront API
- **Interactive Chat**: Real-time conversation with the AI host
- **Smart Cart**: Add products and calculate totals automatically
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** to [http://localhost:3000](http://localhost:3000)

## Configuration

The app works out of the box with mock data, but you can connect to real Shopify stores:

### Shopify Setup (Optional)

1. Go to your Shopify admin → Apps → Develop apps
2. Create a new app with Storefront API access
3. Generate a Storefront access token
4. Enter your shop domain (e.g., `mystore.myshopify.com`) and token in the app settings

### Avatar Video (Optional)

- Add an MP4 video URL for your AI avatar
- The video will play in the host window
- Recommended: Use a looping video of a person speaking

### AI Integration (Optional)

- Connect to your own LLM API endpoint
- The app includes a mock AI response by default
- API should accept `{ prompt, products, lang }` and return `{ answer }`

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Radix UI patterns
- **Icons**: Lucide React
- **API**: Shopify Storefront GraphQL API

## Deployment

This app is ready to deploy to any platform that supports Next.js:

- **Vercel**: `vercel deploy`
- **Netlify**: Connect your Git repository
- **Railway**: `railway deploy`

## Hackathon Submission

Built for the **Shopify: Hack Shopping with AI** challenge. This project demonstrates:

- ✅ AI-powered commerce innovation
- ✅ Enhanced customer experience
- ✅ Shopify ecosystem integration
- ✅ Real-time interactive features
- ✅ Multilingual accessibility

## Demo Features

1. **Ask the AI Host**: Type queries like "show me sneakers under $100"
2. **Product Discovery**: Browse AI-curated product recommendations
3. **Interactive Chat**: Have conversations with the AI about products
4. **Smart Shopping**: Add items to cart with intelligent suggestions
5. **Language Support**: Switch between multiple languages

## Future Enhancements

- Voice interaction with speech-to-text
- AR product previews
- Real-time community voting
- Advanced AI personalization
- Video streaming integration
- Social shopping features

---

**Made with ❤️ for the Shopify AI Hackathon**
