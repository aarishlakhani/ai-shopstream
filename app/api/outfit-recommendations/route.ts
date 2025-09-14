import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { query, products, budget } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });
    }

    if (!query || !products || !Array.isArray(products)) {
      return NextResponse.json({ error: 'Missing query or products data' }, { status: 400 });
    }

    // Prepare product data for AI analysis
    const productSummary = products.map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      tags: p.tags,
      inventory: p.inventory || 1, // Default to 1 if inventory is 0 or undefined
      image: p.image,
      inStock: (p.inventory || 0) >= 0 // Consider available if inventory >= 0
    }));

    const prompt = `You are a professional fashion stylist AI. Based on the user's request and available inventory, recommend the best outfit combinations.

User Request: "${query}"
${budget ? `Budget: $${budget}` : 'No budget specified'}

Available Products:
${JSON.stringify(productSummary, null, 2)}

Please analyze the inventory and provide outfit recommendations. ALL ITEMS IN THE PROVIDED INVENTORY ARE AVAILABLE FOR RECOMMENDATION - do not exclude items based on inventory levels.

Create outfit combinations using the available products:
1. Primary outfit recommendation (2-4 items that work together)
2. Alternative outfit options (if available)
3. Style reasoning for each recommendation
4. Total cost for each outfit

Respond in JSON format:
{
  "primaryOutfit": {
    "items": [{"id": "product_id", "title": "product_name", "price": 0, "reason": "why this item"}],
    "totalCost": 0,
    "styleDescription": "description of the overall look",
    "occasion": "what this outfit is good for"
  },
  "alternativeOutfits": [
    {
      "items": [{"id": "product_id", "title": "product_name", "price": 0, "reason": "why this item"}],
      "totalCost": 0,
      "styleDescription": "description",
      "occasion": "occasion"
    }
  ],
  "stylingTips": ["tip1", "tip2", "tip3"]
}

Use the provided products to create stylish, cohesive outfits that match the user's request. Focus on style compatibility and the user's described needs.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional fashion stylist with expertise in creating cohesive outfits from available inventory. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let recommendations;
    try {
      recommendations = JSON.parse(aiResponse);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      recommendations = {
        primaryOutfit: {
          items: [],
          totalCost: 0,
          styleDescription: "Unable to parse AI recommendations",
          occasion: "general"
        },
        alternativeOutfits: [],
        stylingTips: ["Try different search terms for better recommendations"]
      };
    }

    return NextResponse.json({
      success: true,
      query,
      recommendations,
      totalProducts: products.length
    });

  } catch (error) {
    console.error('Outfit Recommendations API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate outfit recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
