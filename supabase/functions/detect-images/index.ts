import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, width, height } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing image for embedded images...", { width, height });

    const prompt = `Analyze this screenshot/mockup and identify ALL visual assets including images, icons, and logos.

INCLUDE:
- Product photos and images
- Hero/banner images
- Profile pictures and avatars
- Content thumbnails
- Illustrations and graphics
- Icons (UI icons, social media icons, app icons, navigation icons)
- Logos (company logos, brand marks, wordmarks, favicon-style logos)
- Any visual element that is not pure text

EXCLUDE:
- Pure text elements without graphics
- Background patterns or solid color fills
- Elements smaller than 2% of the total image dimensions

For each visual asset found, provide PRECISE bounding box coordinates as percentages:

CRITICAL PRECISION RULES:
- Measure from the EXACT pixel where visual content BEGINS (not whitespace, margins, or padding)
- For images with drop shadows, crop to the SOLID CONTENT only, NOT the shadow
- For rounded corner images, use the rectangular bounds that contain all visible pixels of the actual image
- Do NOT include any surrounding whitespace, borders, or UI chrome
- Double-check: left_edge + width should equal right_edge exactly
- PREFER SLIGHTLY TIGHTER crops over loose ones - it's better to crop a tiny bit into content than to include extra whitespace
- For photos/images: find where the actual image pixels start and end
- For icons: crop to the icon graphic itself, not the touch target or container

Return JSON:
{
  "regions": [
    {
      "x_percent": <left edge 0-100, precise to 2 decimals>,
      "y_percent": <top edge 0-100, precise to 2 decimals>,
      "width_percent": <width 0-100, precise to 2 decimals>,
      "height_percent": <height 0-100, precise to 2 decimals>,
      "label": "<descriptive label like 'Logo', 'Icon - Twitter', 'Product Image'>"
    }
  ],
  "confidence": <0-1>
}

Rules:
- Include elements that are at least 2% of total dimensions in BOTH width AND height
- Bounding boxes must TIGHTLY fit the actual visual content with NO extra padding
- If no visual assets found, return empty regions array
- Return ONLY valid JSON, no other text`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response:", content);

    // Parse the JSON from the response
    let parsed;
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      parsed = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert percentages to pixel coordinates and filter small regions
    // Apply a small inset correction to tighten detected regions (AI tends to overestimate)
    const minWidthPercent = 2;
    const minHeightPercent = 2;
    const insetPercent = 0.5; // Tighten each edge by 0.5%
    
    const regions = (parsed.regions || [])
      .filter((region: any) => {
        // Filter out regions smaller than 2% in either dimension
        return region.width_percent >= minWidthPercent && region.height_percent >= minHeightPercent;
      })
      .map((region: any, index: number) => {
        // Apply inset to tighten the bounding box
        const adjustedX = region.x_percent + insetPercent;
        const adjustedY = region.y_percent + insetPercent;
        const adjustedWidth = Math.max(region.width_percent - (insetPercent * 2), 1);
        const adjustedHeight = Math.max(region.height_percent - (insetPercent * 2), 1);
        
        return {
          id: `detected-${index}-${Date.now()}`,
          x: Math.round((adjustedX / 100) * width),
          y: Math.round((adjustedY / 100) * height),
          width: Math.round((adjustedWidth / 100) * width),
          height: Math.round((adjustedHeight / 100) * height),
          label: region.label || `Image ${index + 1}`,
        };
      });

    console.log("Detected regions:", regions.length);

    return new Response(
      JSON.stringify({
        regions,
        confidence: parsed.confidence || 0.8,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Detection error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Detection failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
