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

    const prompt = `Find ALL visual elements in this image (photos, icons, logos, illustrations, graphics).

For each element, return its EXACT bounding box as percentages (0-100):
- x_percent: left edge
- y_percent: top edge  
- width_percent: width
- height_percent: height
- label: descriptive name

CRITICAL: Boxes must TIGHTLY fit the visual content - NO whitespace, NO padding, NO shadows. Crop to the actual pixels of each image/icon.

Minimum size: 2% in both dimensions.

Return ONLY this JSON format:
{"regions": [{"x_percent": 0.00, "y_percent": 0.00, "width_percent": 0.00, "height_percent": 0.00, "label": ""}], "confidence": 0.0}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
    const minWidthPercent = 2;
    const minHeightPercent = 2;
    
    console.log("Raw AI percentages:", JSON.stringify(parsed.regions, null, 2));
    
    const regions = (parsed.regions || [])
      .filter((region: any) => {
        // Filter out regions smaller than 2% in either dimension
        return region.width_percent >= minWidthPercent && region.height_percent >= minHeightPercent;
      })
      .map((region: any, index: number) => {
        // Direct conversion without inset correction to see raw AI output
        const pixelX = Math.round((region.x_percent / 100) * width);
        const pixelY = Math.round((region.y_percent / 100) * height);
        const pixelWidth = Math.round((region.width_percent / 100) * width);
        const pixelHeight = Math.round((region.height_percent / 100) * height);
        
        console.log(`Region ${index} "${region.label}": ${region.x_percent}%,${region.y_percent}% ${region.width_percent}%x${region.height_percent}% -> ${pixelX},${pixelY} ${pixelWidth}x${pixelHeight}px`);
        
        return {
          id: `detected-${index}-${Date.now()}`,
          x: pixelX,
          y: pixelY,
          width: pixelWidth,
          height: pixelHeight,
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
