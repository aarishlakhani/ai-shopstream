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

// Utility for cart calculations
function computeSubtotal(products: any[], cart: Record<string, number>) {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === id) || MOCK_PRODUCTS.find((x) => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

export default function AIShopstream() {
  // Settings - Load from environment variables
  const [shopDomain, setShopDomain] = useState(process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN || "");
  const [storefrontToken, setStorefrontToken] = useState(process.env.NEXT_PUBLIC_SHOPIFY_TOKEN || "");
  const [llmUrl, setLlmUrl] = useState("");

  // Core state
  const [lang, setLang] = useState("en");
  const [query, setQuery] = useState("casual hoodie");
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

  // Fetch products
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchStorefrontProducts(query, shopDomain, storefrontToken);
        setProducts(res && res.length ? res : MOCK_PRODUCTS);
      } catch (e) {
        console.error(e);
        const res = await mockFetchProducts(query);
        setProducts(res && res.length ? res : MOCK_PRODUCTS);
      }
    })();
  }, [query, shopDomain, storefrontToken]);

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
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-full h-full">
                          <img 
                            src={selectedProduct.image} 
                            alt={selectedProduct.title}
                            className="absolute inset-0 w-full h-full object-contain opacity-60 mix-blend-multiply"
                            style={{
                              maskImage: 'radial-gradient(ellipse 40% 60% at center 35%, black 0%, black 40%, transparent 70%)',
                              WebkitMaskImage: 'radial-gradient(ellipse 40% 60% at center 35%, black 0%, black 40%, transparent 70%)'
                            }}
                          />
                          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 text-center shadow-lg">
                            <p className="text-sm font-medium text-gray-800">Virtual Try-On</p>
                            <p className="text-xs text-gray-600">{selectedProduct.title}</p>
                            <p className="text-xs text-purple-600 font-medium">${selectedProduct.price.toFixed(2)}</p>
                          </div>
                        </div>
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
