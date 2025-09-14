import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { shopDomain, storefrontToken, cursor } = await request.json();

    if (!shopDomain || !storefrontToken) {
      return NextResponse.json({ error: 'Missing shopDomain or storefrontToken' }, { status: 400 });
    }

    const endpoint = `https://${shopDomain}/api/2024-07/graphql.json`;
    const body = {
      query: `query BulkProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges { 
            node {
              id
              title
              tags
              totalInventory
              images(first: 1) { 
                edges { 
                  node { 
                    url 
                  } 
                } 
              }
              variants(first: 1) { 
                edges { 
                  node { 
                    id 
                    price { 
                      amount 
                      currencyCode
                    } 
                  } 
                } 
              }
            }
          }
        }
      }`,
      variables: { cursor }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Shopify Bulk API Error:', res.status, errorText);
      return NextResponse.json({ error: `Shopify API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Bulk API Route Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
