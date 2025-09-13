import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, products, lang } = await request.json();
    
    // Mock AI response - in production, this would call a real LLM
    const filteredProducts = products.filter((p: any) => p.price <= 100);
    const bestProduct = filteredProducts.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    
    let response = "";
    
    if (bestProduct) {
      response = `Based on your query "${prompt}", I recommend the ${bestProduct.title} for $${bestProduct.price}. It has a ${bestProduct.rating} star rating and features: ${bestProduct.features?.slice(0, 2).join(", ") || "Great quality"}. Available in ${bestProduct.colors?.join(", ") || "multiple colors"} with ${bestProduct.inventory} units in stock.`;
    } else {
      response = `I couldn't find products matching "${prompt}" in your budget. Let me show you our best alternatives!`;
    }
    
    // Simple translation
    if (lang === "fr") response = `FR: ${response}`;
    if (lang === "es") response = `ES: ${response}`;
    if (lang === "hi") response = `HI: ${response}`;
    
    return NextResponse.json({ answer: response });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
