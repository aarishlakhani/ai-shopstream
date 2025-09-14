"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Sparkles, Upload, MessageCircle, Camera, RotateCcw } from "lucide-react";

// Mock Data Fallback
const MOCK_PRODUCTS = [
  { id: "gid://shopify/Product/1", title: "StrideRunner Sneaker", price: 89.99, image: "https://placehold.co/480x600?text=StrideRunner", tags: ["sneakers", "running", "breathable"], rating: 4.6, features: ["Mesh upper", "Cushion midsole", "Rubber outsole"], colors: ["Black", "White", "Volt"], inventory: 27 },
  { id: "gid://shopify/Product/2", title: "CloudLite Trainer", price: 99.0, image: "https://placehold.co/480x600?text=CloudLite", tags: ["sneakers", "training", "lightweight"], rating: 4.4, features: ["Knit upper", "Responsive foam", "Heel loop"], colors: ["Blue", "Grey"], inventory: 11 },
  { id: "gid://shopify/Product/3", title: "UrbanFlex High-Top", price: 79.5, image: "https://placehold.co/480x600?text=UrbanFlex", tags: ["sneakers", "streetwear"], rating: 4.1, features: ["Canvas", "Padded collar", "Grippy sole"], colors: ["Black", "Red"], inventory: 42 }
];

// Lightweight local search for mock fallback
async function mockFetchProducts(query: string) {
  const q = (query || "").toLowerCase();
  if (!q) return MOCK_PRODUCTS;
  return MOCK_PRODUCTS.filter(
    (p) => p.title.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// Storefront API fetch via API route
async function fetchStorefrontProducts(query: string, shopDomain: string, storefrontToken: string) {
  if (!shopDomain || !storefrontToken) {
    console.log('⚠️ Missing Shopify credentials, using mock data:', { 
      shopDomain: shopDomain || 'MISSING', 
      hasToken: !!storefrontToken 
    });
    return mockFetchProducts(query);
  }

  try {
    console.log('🔍 Shopify API Debug:', { shopDomain, tokenLength: storefrontToken.length, query });
    
    const res = await fetch('/api/shopify', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        shopDomain,
        storefrontToken
      }),
    });

    console.log('📡 API Response:', { status: res.status, ok: res.ok });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('❌ API Error Response:', errorData);
      throw new Error(`API error: ${res.status} - ${errorData.error}`);
    }
    
    const data = await res.json();
    console.log('📦 API Data:', data);
    
    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      console.error('🚨 GraphQL Errors:', data.errors);
      data.errors.forEach((error: any, index: number) => {
        console.error(`Error ${index + 1}:`, error.message);
      });
    }
    
    const edges = data?.data?.products?.edges ?? [];
    console.log('🛍️ Products found:', edges.length);

    const mapped = edges.map((e: any) => {
      const n = e.node;
      return {
        id: n.id,
        title: n.title,
        price: Number(n.variants?.edges?.[0]?.node?.price?.amount ?? 0),
        image: n.images?.edges?.[0]?.node?.url || "https://placehold.co/480x600?text=No+Image",
        tags: n.tags || [],
        rating: 4.5,
        features: (n.metafields?.edges || []).slice(0, 3).map((m: any) => `${m.node.key}: ${m.node.value}`),
        colors: ["Default"],
        inventory: n.totalInventory ?? 0,
        variantId: n.variants?.edges?.[0]?.node?.id,
      };
    });

    console.log('✅ Mapped products:', mapped);
    return mapped.length ? mapped : mockFetchProducts(query);
  } catch (e) {
    console.error('💥 Shopify API Error:', e);
    return mockFetchProducts(query);
  }
}

// Fallback LLM answer
async function mockLLMAnswer(prompt: string, products: any[], lang: string) {
  const best = products.filter((p) => p.price <= 100).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const base = best
    ? `Best under budget: ${best.title} ($${best.price}). Features: ${(best.features || []).slice(0,2).join(", ")}.`
    : `I couldn't find an item under that budget in stock.`;
  return translate(base, lang);
}

// Simple translator
function translate(text: string, lang: string) {
  if (lang === "fr") return `FR: ${text}`;
  if (lang === "es") return `ES: ${text}`;
  if (lang === "hi") return `HI: ${text}`;
  return text;
}

// Structured inventory storage system
interface ProductData {
  id: string;
  title: string;
  price: number;
  image: string;
  tags: string[];
  rating: number;
  features: string[];
  colors: string[];
  inventory: number;
  variantId?: string;
  description?: string;
  vendor?: string;
  productType?: string;
  createdAt?: string;
  updatedAt?: string;
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    inventory: number;
    sku?: string;
    barcode?: string;
  }>;
  images?: Array<{
    id: string;
    url: string;
    altText?: string;
  }>;
  metafields?: Array<{
    key: string;
    value: string;
    type: string;
  }>;
}

interface InventoryStore {
  products: Map<string, ProductData>;
  categories: Map<string, string[]>; // category -> product IDs
  tags: Map<string, string[]>; // tag -> product IDs
  lastUpdated: Date | null;
  isLoading: boolean;
  totalCount: number;
}

// Global inventory storage
let inventoryStore: InventoryStore = {
  products: new Map(),
  categories: new Map(),
  tags: new Map(),
  lastUpdated: null,
  isLoading: false,
  totalCount: 0
};

// Utility for cart calculations
function computeSubtotal(products: any[], cart: Record<string, number>) {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === id) || MOCK_PRODUCTS.find((x) => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

// Bulk fetch all products from Shopify
async function fetchAllShopifyProducts(shopDomain: string, storefrontToken: string): Promise<ProductData[]> {
  if (!shopDomain || !storefrontToken) {
    console.log('⚠️ Missing Shopify credentials for bulk fetch');
    return [];
  }

  const allProducts: ProductData[] = [];
  let hasNextPage = true;
  let cursor = null;

  try {
    while (hasNextPage) {
      const res: Response = await fetch('/api/shopify-bulk', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          storefrontToken,
          cursor
        }),
      });

      if (!res.ok) {
        throw new Error(`Bulk fetch failed: ${res.status}`);
      }

      const data: any = await res.json();
      const edges = data?.data?.products?.edges ?? [];
      
      edges.forEach((edge: any) => {
        const node = edge.node;
        const product: ProductData = {
          id: node.id,
          title: node.title,
          price: Number(node.variants?.edges?.[0]?.node?.price?.amount ?? 0),
          image: node.images?.edges?.[0]?.node?.url || "https://placehold.co/480x600?text=No+Image",
          tags: node.tags || [],
          rating: 4.5, // Default rating
          features: [], // Simplified for bulk fetch
          colors: ["Default"],
          inventory: node.totalInventory ?? 0,
          variantId: node.variants?.edges?.[0]?.node?.id,
          description: "", // Not available in simplified query
          vendor: "", // Not available in simplified query
          productType: "", // Not available in simplified query
          createdAt: "", // Not available in simplified query
          updatedAt: "", // Not available in simplified query
          variants: node.variants?.edges?.map((v: any) => ({
            id: v.node.id,
            title: "",
            price: Number(v.node.price?.amount ?? 0),
            inventory: 0,
            sku: "",
            barcode: ""
          })) || [],
          images: node.images?.edges?.map((img: any) => ({
            id: "",
            url: img.node.url,
            altText: ""
          })) || [],
          metafields: []
        };
        allProducts.push(product);
      });

      hasNextPage = data?.data?.products?.pageInfo?.hasNextPage ?? false;
      cursor = data?.data?.products?.pageInfo?.endCursor;
    }

    console.log(`✅ Fetched ${allProducts.length} products from Shopify`);
    return allProducts;
  } catch (error) {
    console.error('❌ Bulk fetch error:', error);
    return [];
  }
}

// Store products in structured inventory
function storeInventoryData(products: ProductData[]) {
  inventoryStore.products.clear();
  inventoryStore.categories.clear();
  inventoryStore.tags.clear();

  products.forEach(product => {
    // Store product
    inventoryStore.products.set(product.id, product);

    // Index by product type (category)
    if (product.productType) {
      const categoryProducts = inventoryStore.categories.get(product.productType) || [];
      categoryProducts.push(product.id);
      inventoryStore.categories.set(product.productType, categoryProducts);
    }

    // Index by tags
    product.tags.forEach(tag => {
      const tagProducts = inventoryStore.tags.get(tag) || [];
      tagProducts.push(product.id);
      inventoryStore.tags.set(tag, tagProducts);
    });
  });

  inventoryStore.totalCount = products.length;
  inventoryStore.lastUpdated = new Date();
  inventoryStore.isLoading = false;

  console.log(`📦 Stored ${products.length} products in inventory cache`);
}

// Search products from stored inventory
function searchStoredInventory(query: string): ProductData[] {
  if (!query.trim()) {
    return Array.from(inventoryStore.products.values()).slice(0, 12);
  }

  const q = query.toLowerCase();
  const results: ProductData[] = [];

  // Search by title, tags, description, vendor
  inventoryStore.products.forEach(product => {
    const matchesTitle = product.title.toLowerCase().includes(q);
    const matchesTags = product.tags.some(tag => tag.toLowerCase().includes(q));
    const matchesDescription = product.description?.toLowerCase().includes(q);
    const matchesVendor = product.vendor?.toLowerCase().includes(q);
    const matchesType = product.productType?.toLowerCase().includes(q);

    if (matchesTitle || matchesTags || matchesDescription || matchesVendor || matchesType) {
      results.push(product);
    }
  });

  return results.slice(0, 12);
}

// Get products by category
function getProductsByCategory(category: string): ProductData[] {
  const productIds = inventoryStore.categories.get(category) || [];
  return productIds.map(id => inventoryStore.products.get(id)).filter(Boolean) as ProductData[];
}

// Get products by tag
function getProductsByTag(tag: string): ProductData[] {
  const productIds = inventoryStore.tags.get(tag) || [];
  return productIds.map(id => inventoryStore.products.get(id)).filter(Boolean) as ProductData[];
}

// Get inventory statistics
function getInventoryStats() {
  return {
    totalProducts: inventoryStore.totalCount,
    categories: inventoryStore.categories.size,
    tags: inventoryStore.tags.size,
    lastUpdated: inventoryStore.lastUpdated,
    isLoading: inventoryStore.isLoading,
    cacheSize: inventoryStore.products.size
  };
}

export default function AIShopstream() {
  // Settings - Load from environment variables
  const [shopDomain, setShopDomain] = useState("");
  const [storefrontToken, setStorefrontToken] = useState("");
  const [llmUrl, setLlmUrl] = useState("");

  // Initialize environment variables on mount
  useEffect(() => {
    const envShopDomain = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN || "";
    const envStorefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_TOKEN || "";
    
    console.log('🔧 Environment variables loaded:', {
      shopDomain: envShopDomain || 'NOT_SET',
      hasToken: !!envStorefrontToken,
      tokenLength: envStorefrontToken?.length || 0
    });
    
    setShopDomain(envShopDomain);
    setStorefrontToken(envStorefrontToken);
  }, []);

  // Core state
  const [lang, setLang] = useState("en");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<any[]>(MOCK_PRODUCTS);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [chat, setChat] = useState<{ user: string; text: string }[]>([
    { user: "AI Stylist", text: "Upload your photo and I'll help you try on clothes virtually!" },
  ]);
  const [msg, setMsg] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [testResults, setTestResults] = useState<{ name: string; pass: boolean; detail?: string }[]>([]);
  const [mounted, setMounted] = useState(false);
  const [userPhoto, setUserPhoto] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // NEW: manual fit controls (percentage offsets + scale)
  const [fit, setFit] = useState({ scale: 0.85, x: 0, y: -6 });

  // Inventory management state
  const [inventoryStats, setInventoryStats] = useState(getInventoryStats());
  const [useStoredInventory, setUseStoredInventory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // Outfit recommendation state
  const [outfitQuery, setOutfitQuery] = useState("");
  const [budget, setBudget] = useState<number | undefined>();
  const [outfitRecommendations, setOutfitRecommendations] = useState<any>(null);
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);
  const [showOutfitMode, setShowOutfitMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle photo upload
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserPhoto(e.target?.result as string);
        setChat((c) => [...c, { user: "You", text: "Photo uploaded! Now select a clothing item to try on." }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerPhotoUpload = () => {
    fileInputRef.current?.click();
  };

  const tryOnProduct = (product: any) => {
    setSelectedProduct(product);
    setChat((c) => [...c, { user: "AI Stylist", text: `Great choice! The ${product.title} would look amazing on you. Here's how it looks virtually applied to your photo.` }]);
  };

  // Fetch products with inventory integration
  useEffect(() => {
    (async () => {
      try {
        if (useStoredInventory && inventoryStats.cacheSize > 0) {
          // Use stored inventory for search
          console.log('🔍 Searching stored inventory:', { query, cacheSize: inventoryStats.cacheSize });
          const results = searchStoredInventory(query);
          setProducts(results);
        } else {
          // Use regular API fetch
          console.log('🔄 Fetching products with credentials:', { 
            shopDomain: shopDomain || 'NOT_SET', 
            hasToken: !!storefrontToken,
            tokenLength: storefrontToken?.length || 0,
            query 
          });
          
          const res = await fetchStorefrontProducts(query, shopDomain, storefrontToken);
          setProducts(res && res.length ? res : MOCK_PRODUCTS);
        }
      } catch (e) {
        console.error('❌ Product fetch error:', e);
        const res = await mockFetchProducts(query);
        setProducts(res && res.length ? res : MOCK_PRODUCTS);
      }
    })();
  }, [query, shopDomain, storefrontToken, useStoredInventory, inventoryStats.cacheSize]);

  // Load full inventory
  const loadFullInventory = async () => {
    if (!shopDomain || !storefrontToken) {
      alert('Please set Shopify credentials first');
      return;
    }

    inventoryStore.isLoading = true;
    setInventoryStats(getInventoryStats());

    try {
      console.log('🚀 Starting bulk inventory fetch...');
      const allProducts = await fetchAllShopifyProducts(shopDomain, storefrontToken);
      
      if (allProducts.length > 0) {
        storeInventoryData(allProducts);
        setInventoryStats(getInventoryStats());
        setUseStoredInventory(true);
        setProducts(searchStoredInventory(query));
        
        setChat(c => [...c, { 
          user: "System", 
          text: `✅ Loaded ${allProducts.length} products into inventory cache. You can now browse all products offline!` 
        }]);
      } else {
        setChat(c => [...c, { 
          user: "System", 
          text: "❌ Failed to load inventory. Check your Shopify credentials." 
        }]);
      }
    } catch (error) {
      console.error('❌ Inventory load error:', error);
      setChat(c => [...c, { 
        user: "System", 
        text: "❌ Error loading inventory. Please try again." 
      }]);
    } finally {
      inventoryStore.isLoading = false;
      setInventoryStats(getInventoryStats());
    }
  };

  // Filter by category
  const filterByCategory = (category: string) => {
    if (!useStoredInventory) return;
    
    setSelectedCategory(category);
    setSelectedTag("");
    const categoryProducts = getProductsByCategory(category);
    setProducts(categoryProducts);
    setQuery(`Category: ${category}`);
  };

  // Filter by tag
  const filterByTag = (tag: string) => {
    if (!useStoredInventory) return;
    
    setSelectedTag(tag);
    setSelectedCategory("");
    const tagProducts = getProductsByTag(tag);
    setProducts(tagProducts);
    setQuery(`Tag: ${tag}`);
  };

  // Generate outfit recommendations using OpenAI
  const generateOutfitRecommendations = async () => {
    if (!outfitQuery.trim()) {
      alert('Please describe the type of outfit you want');
      return;
    }

    if (!useStoredInventory || inventoryStats.cacheSize === 0) {
      alert('Please load full inventory first to get AI outfit recommendations');
      return;
    }

    setIsGeneratingOutfit(true);
    
    try {
      const allProducts = Array.from(inventoryStore.products.values());
      
      const response = await fetch('/api/outfit-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: outfitQuery,
          products: allProducts,
          budget: budget
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setOutfitRecommendations(data.recommendations);
        setChat(c => [...c, { 
          user: "AI Stylist", 
          text: `✨ I've analyzed your ${allProducts.length} products and created perfect outfit recommendations for "${outfitQuery}"!` 
        }]);
      } else {
        throw new Error(data.error || 'Failed to generate recommendations');
      }
    } catch (error) {
      console.error('Outfit generation error:', error);
      setChat(c => [...c, { 
        user: "AI Stylist", 
        text: `❌ Sorry, I couldn't generate outfit recommendations. ${error instanceof Error ? error.message : 'Please try again.'}` 
      }]);
    } finally {
      setIsGeneratingOutfit(false);
    }
  };

  // Apply outfit recommendation to products view
  const applyOutfitRecommendation = (outfit: any) => {
    const outfitProductIds = outfit.items.map((item: any) => item.id);
    const outfitProducts = outfitProductIds
      .map((id: string) => inventoryStore.products.get(id))
      .filter(Boolean);
    
    setProducts(outfitProducts);
    setQuery(`AI Outfit: ${outfit.styleDescription}`);
    
    setChat(c => [...c, { 
      user: "AI Stylist", 
      text: `👗 Applied "${outfit.styleDescription}" outfit - ${outfit.items.length} items, total cost: $${outfit.totalCost}` 
    }]);
  };

  const subtotal = useMemo(() => computeSubtotal(products, cart), [cart, products]);

  const handleSend = () => {
    if (!msg.trim()) return;
    setChat((c) => [...c, { user: "You", text: msg.trim() }]);
    setMsg("");
  };

  // Prevent hydration errors by not rendering until mounted
  if (!mounted) {
    return null;
  }

  const addToCart = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));

  const askStylist = async () => {
    try {
      if (llmUrl) {
        const res = await fetch(llmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: query, products, lang, hasPhoto: !!userPhoto })
        });
        const data = await res.json();
        const a = data?.answer || "(No answer returned)";
        setAnswer(a);
        setChat((c) => [...c, { user: "AI Stylist", text: a }]);
      } else {
        const a = await mockLLMAnswer(query, products, lang);
        setAnswer(a);
        setChat((c) => [...c, { user: "AI Stylist", text: a }]);
      }
    } catch (e: any) {
      const a = `AI Stylist: ${await mockLLMAnswer(query, products, lang)}`;
      setAnswer(a);
      setChat((c) => [...c, { user: "AI Stylist", text: a }]);
    }
  };

  // Diagnostics
  async function runDiagnostics() {
    const results: { name: string; pass: boolean; detail?: string }[] = [];

    // Test 1: No Node process requirement
    const procDefined = typeof (globalThis as any).process !== "undefined";
    results.push({ name: "No Node process dependency", pass: !procDefined, detail: !procDefined ? "process is undefined (OK)" : "process exists (polyfilled)" });

    // Test 2: Mock product fetch
    try {
      const res = await fetchStorefrontProducts("sneaker", "", "");
      results.push({ name: "Mock products fallback", pass: Array.isArray(res) && res.length > 0, detail: `${res.length} items` });
    } catch (e: any) {
      results.push({ name: "Mock products fallback", pass: false, detail: e?.message || String(e) });
    }

    // Test 3: LLM fallback
    try {
      const a = await mockLLMAnswer("under 100", MOCK_PRODUCTS, "en");
      results.push({ name: "LLM fallback answer", pass: typeof a === "string" && a.length > 0, detail: a.slice(0, 80) + (a.length > 80 ? "…" : "") });
    } catch (e: any) {
      results.push({ name: "LLM fallback answer", pass: false, detail: e?.message || String(e) });
    }

    // Test 4: Cart math
    try {
      const sampleCart = { [MOCK_PRODUCTS[0].id]: 2, [MOCK_PRODUCTS[1].id]: 1 } as Record<string, number>;
      const sub = computeSubtotal(MOCK_PRODUCTS, sampleCart);
      const expected = MOCK_PRODUCTS[0].price * 2 + MOCK_PRODUCTS[1].price * 1;
      results.push({ name: "Cart subtotal math", pass: Math.abs(sub - expected) < 1e-6, detail: `computed=${sub.toFixed(2)} expected=${expected.toFixed(2)}` });
    } catch (e: any) {
      results.push({ name: "Cart subtotal math", pass: false, detail: e?.message || String(e) });
    }

    setTestResults(results);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-purple-600" /> AI Virtual Try-On
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Virtual Styling</Badge>
          <Badge variant="outline">AI Powered</Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Virtual Try-On Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 aspect-video relative flex items-center justify-center">
                {userPhoto ? (
                  <div className="relative w-full h-full">
                    <img src={userPhoto} alt="Your photo" className="w-full h-full object-cover" />
                    {selectedProduct && (
                      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 text-center shadow-lg">
                        <p className="text-sm font-medium text-gray-800">Selected Product</p>
                        <p className="text-xs text-gray-600">{selectedProduct.title}</p>
                        <p className="text-xs text-purple-600 font-medium">${selectedProduct.price.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <Camera className="w-16 h-16 text-purple-400 mx-auto" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700">Upload Your Photo</h3>
                      <p className="text-sm text-gray-500">See how clothes look on you with AI virtual try-on</p>
                    </div>
                    <Button onClick={triggerPhotoUpload} className="bg-purple-600 hover:bg-purple-700">
                      <Upload className="w-4 h-4 mr-2" /> Upload Photo
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {userPhoto && (
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={triggerPhotoUpload}>
                      <Upload className="w-4 h-4 mr-1" /> Change Photo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {setUserPhoto(""); setSelectedProduct(null);}}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Reset
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Tabs value={lang} onValueChange={(v) => setLang(v)}>
                <TabsList>
                  <TabsTrigger value="en">EN</TabsTrigger>
                  <TabsTrigger value="fr">FR</TabsTrigger>
                  <TabsTrigger value="es">ES</TabsTrigger>
                  <TabsTrigger value="hi">HI</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2">
                <Input 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                  placeholder="Describe what you're looking for… e.g., 'casual hoodie for winter'" 
                />
                <Button onClick={askStylist}>
                  <Sparkles className="w-4 h-4 mr-1" /> Ask Stylist
                </Button>
              </div>
              {answer && <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Right: Chat + Products + Cart */}
        <div className="space-y-4">
          <Card className="h-[22rem] flex flex-col">
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-2">
              {chat.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className={`font-medium ${m.user === "Host" ? "text-purple-700" : "text-slate-700"}`}>
                    {m.user}:
                  </span>{" "}
                  <span>{m.text}</span>
                </div>
              ))}
            </CardContent>
            <Separator />
            <div className="p-3 flex gap-2">
              <Input 
                value={msg} 
                onChange={(e) => setMsg(e.target.value)} 
                placeholder="Type a message" 
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <Button onClick={handleSend}>
                <MessageCircle className="w-4 h-4 mr-1" /> Send
              </Button>
            </div>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">AI Outfit Recommendations</h3>
                <Button
                  size="sm"
                  variant={showOutfitMode ? "default" : "outline"}
                  onClick={() => setShowOutfitMode(!showOutfitMode)}
                  className="text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {showOutfitMode ? "Hide" : "Show"} AI Mode
                </Button>
              </div>

              {showOutfitMode && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-2">
                    <Input
                      placeholder="Describe your ideal outfit (e.g., 'casual weekend look', 'business professional', 'date night outfit')"
                      value={outfitQuery}
                      onChange={(e) => setOutfitQuery(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Budget (optional)"
                        value={budget || ""}
                        onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : undefined)}
                        className="text-sm flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={generateOutfitRecommendations}
                        disabled={isGeneratingOutfit || !useStoredInventory}
                        className="text-xs"
                      >
                        {isGeneratingOutfit ? "Generating..." : "Get AI Recommendations"}
                      </Button>
                    </div>
                  </div>

                  {!useStoredInventory && (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      💡 Load full inventory first to enable AI outfit recommendations
                    </div>
                  )}

                  {outfitRecommendations && (
                    <div className="space-y-3 border-t pt-3">
                      <h4 className="text-sm font-medium text-green-700">✨ AI Recommendations</h4>
                      
                      {/* Primary Outfit */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-green-800">
                            Primary Outfit - ${outfitRecommendations.primaryOutfit?.totalCost?.toFixed(2)}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => applyOutfitRecommendation(outfitRecommendations.primaryOutfit)}
                            className="text-xs"
                          >
                            Apply
                          </Button>
                        </div>
                        <p className="text-xs text-green-700">
                          {outfitRecommendations.primaryOutfit?.styleDescription}
                        </p>
                        <div className="text-xs text-green-600">
                          Items: {outfitRecommendations.primaryOutfit?.items?.map((item: any) => item.title).join(", ")}
                        </div>
                      </div>

                      {/* Alternative Outfits */}
                      {outfitRecommendations.alternativeOutfits?.map((outfit: any, index: number) => (
                        <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-800">
                              Alternative {index + 1} - ${outfit.totalCost?.toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applyOutfitRecommendation(outfit)}
                              className="text-xs"
                            >
                              Apply
                            </Button>
                          </div>
                          <p className="text-xs text-blue-700">{outfit.styleDescription}</p>
                          <div className="text-xs text-blue-600">
                            Items: {outfit.items?.map((item: any) => item.title).join(", ")}
                          </div>
                        </div>
                      ))}

                      {/* Styling Tips */}
                      {outfitRecommendations.stylingTips && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <h5 className="text-xs font-medium text-purple-800 mb-1">💡 Styling Tips</h5>
                          <ul className="text-xs text-purple-700 space-y-1">
                            {outfitRecommendations.stylingTips.map((tip: string, index: number) => (
                              <li key={index}>• {tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Featured Products</h3>
              <div className="space-y-3">
                {products.map((p) => (
                  <Card key={p.id} className="overflow-hidden">
                    <div className="flex flex-col">
                      <div className="w-full h-48">
                        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                      <CardContent className="p-3 space-y-3">
                        <div className="space-y-2">
                          <div className="font-medium text-sm leading-tight">{p.title}</div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-muted-foreground flex-shrink-0">
                              ${p.price.toFixed(2)} · ⭐ {p.rating ?? "-"}
                            </div>
                            <Badge variant={p.inventory > 15 ? "secondary" : "destructive"} className="text-xs flex-shrink-0">
                              {p.inventory > 15 ? "In stock" : "Low stock"}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button size="sm" className="text-xs" onClick={() => tryOnProduct(p)}>
                            <Camera className="w-3 h-3 mr-1" /> Try On
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => addToCart(p.id)}>
                            <ShoppingCart className="w-3 h-3 mr-1" /> Add to cart
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">Cart</h3>
              {Object.keys(cart).length === 0 ? (
                <p className="text-sm text-muted-foreground">No items yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(cart).map(([id, qty]) => {
                    const p = products.find((x) => x.id === id) || MOCK_PRODUCTS.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className="flex items-center justify-between text-sm">
                        <span>{p.title} × {qty}</span>
                        <span>${(p.price * (qty as number)).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <Separator />
                  <div className="flex items-center justify-between font-medium">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <Button className="w-full">Checkout</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Settings & Diagnostics */}
      <Card className="shadow-none border-dashed">
        <CardContent className="p-4 text-sm leading-relaxed text-muted-foreground space-y-3">
          <h3 className="text-base font-semibold text-slate-800">Quick Setup</h3>
          
          {/* Inventory Management Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-blue-800">Inventory Management</h4>
              <Badge variant={useStoredInventory ? "default" : "secondary"}>
                {useStoredInventory ? "Using Cache" : "Live API"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Products: {inventoryStats.totalProducts}</div>
              <div>Categories: {inventoryStats.categories}</div>
              <div>Tags: {inventoryStats.tags}</div>
              <div>Cache Size: {inventoryStats.cacheSize}</div>
            </div>
            
            {inventoryStats.lastUpdated && (
              <div className="text-xs text-blue-600">
                Last Updated: {inventoryStats.lastUpdated.toLocaleTimeString()}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={loadFullInventory}
                disabled={inventoryStats.isLoading}
                className="text-xs"
              >
                {inventoryStats.isLoading ? "Loading..." : "Load Full Inventory"}
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setUseStoredInventory(!useStoredInventory);
                  setQuery("");
                }}
                className="text-xs"
              >
                {useStoredInventory ? "Use Live API" : "Use Cache"}
              </Button>
            </div>
            
            {useStoredInventory && inventoryStats.cacheSize > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-blue-700">Quick Filters:</div>
                <div className="flex flex-wrap gap-1">
                  {Array.from(inventoryStore.categories.keys()).slice(0, 5).map(category => (
                    <Button
                      key={category}
                      size="sm"
                      variant={selectedCategory === category ? "default" : "outline"}
                      onClick={() => filterByCategory(category)}
                      className="text-xs px-2 py-1 h-auto"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from(inventoryStore.tags.keys()).slice(0, 8).map(tag => (
                    <Button
                      key={tag}
                      size="sm"
                      variant={selectedTag === tag ? "default" : "outline"}
                      onClick={() => filterByTag(tag)}
                      className="text-xs px-2 py-1 h-auto"
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">Shop Domain</div>
              <Input 
                placeholder="mystore.myshopify.com" 
                value={shopDomain}
                disabled
                className="bg-gray-50"
              />
              <div className="text-[11px] text-slate-500">Loaded from NEXT_PUBLIC_SHOPIFY_DOMAIN</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">Storefront Token</div>
              <Input 
                placeholder="Storefront token" 
                value={storefrontToken ? "••••••••••••••••" : "Not configured"}
                disabled
                className="bg-gray-50"
              />
              <div className="text-[11px] text-slate-500">Loaded from NEXT_PUBLIC_SHOPIFY_TOKEN</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">Virtual Try-On API (optional)</div>
              <Input 
                placeholder="/api/virtual-tryon" 
                value={llmUrl} 
                onChange={(e) => setLlmUrl(e.target.value)} 
              />
              <div className="text-[11px] text-slate-500">API endpoint for advanced virtual try-on processing.</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">LLM API URL (optional)</div>
              <Input 
                placeholder="/api/answer" 
                value={llmUrl} 
                onChange={(e) => setLlmUrl(e.target.value)} 
              />
              <div className="text-[11px] text-slate-500">If empty, a mock answer is used.</div>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={runDiagnostics}>
              Run Diagnostics & Tests
            </Button>
            {testResults.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {testResults.map((t, i) => (
                  <Badge key={i} variant={t.pass ? "secondary" : "destructive"}>
                    {t.pass ? "PASS" : "FAIL"}: {t.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {testResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testResults.map((t, i) => (
                <div key={i} className="text-xs text-slate-600">
                  <span className="font-medium">{t.name}:</span> {t.detail}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
