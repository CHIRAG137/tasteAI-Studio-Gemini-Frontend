import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Video,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Move,
  ZoomIn,
  ZoomOut,
  Crop,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoBotSectionProps {
  botConfig: {
    isVideoBot: boolean;
    videoBotImageUrl?: string;
    videoBotImagePublicId?: string;
    voiceId?: string;
  };
  updateConfig: (field: string, value: any) => void;
}

export const VideoBotSection = ({
  botConfig,
  updateConfig,
}: VideoBotSectionProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const hiddenImageRef = useRef<HTMLImageElement>(null);
  const VOICES_PAGE_SIZE = 6;

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [visibleVoiceCount, setVisibleVoiceCount] = useState(VOICES_PAGE_SIZE);

  // Image cropping state
  const [showCropTool, setShowCropTool] = useState(false);
  const [cropCircle, setCropCircle] = useState({ x: 0, y: 0, radius: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [generatedImageForCrop, setGeneratedImageForCrop] = useState<string | null>(null);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!botConfig.isVideoBot) return;
    if (voices.length > 0) return;

    const fetchVoices = async () => {
      setVoicesLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/elevenlabs/voices`
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        const premadeVoices = (data.result || []).filter(
          (voice: any) => voice.category === "premade"
        );

        setVoices(premadeVoices);

        if (premadeVoices.length > 0 && !botConfig.voiceId) {
          updateConfig("voiceId", premadeVoices[0].voice_id);
        }
      } catch (err) {
        console.error("Voice fetch failed:", err);
        toast({
          title: "Failed to load voices",
          description: "Could not fetch ElevenLabs voices",
          variant: "destructive",
        });
      } finally {
        setVoicesLoading(false);
      }
    };

    fetchVoices();
  }, [botConfig.isVideoBot]);

  useEffect(() => {
    if (botConfig.isVideoBot && !imagePrompt && !generatedImageUrl) {
      setImagePrompt("Transform this into a professional business avatar wearing formal business attire (suit or blazer) on a clean white background, professional studio lighting, corporate headshot style");
    }
  }, [botConfig.isVideoBot]);

  const generatedImageUrl = botConfig.videoBotImageUrl || null;

  // Draw crop circle on canvas
  useEffect(() => {
    if (!showCropTool || !canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imageRef.current;

    // Set canvas size to match displayed image
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out circle (destination-out for transparency)
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cropCircle.x, cropCircle.y, cropCircle.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw circle border
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cropCircle.x, cropCircle.y, cropCircle.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center crosshair
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cropCircle.x - 10, cropCircle.y);
    ctx.lineTo(cropCircle.x + 10, cropCircle.y);
    ctx.moveTo(cropCircle.x, cropCircle.y - 10);
    ctx.lineTo(cropCircle.x, cropCircle.y + 10);
    ctx.stroke();
  }, [showCropTool, cropCircle, imageLoaded]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is inside circle
    const distance = Math.sqrt(
      Math.pow(x - cropCircle.x, 2) + Math.pow(y - cropCircle.y, 2)
    );

    if (distance <= cropCircle.radius) {
      setIsDragging(true);
      setDragStart({ x: x - cropCircle.x, y: y - cropCircle.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let newX = x - dragStart.x;
    let newY = y - dragStart.y;

    // Keep circle within canvas bounds
    newX = Math.max(cropCircle.radius, Math.min(canvas.width - cropCircle.radius, newX));
    newY = Math.max(cropCircle.radius, Math.min(canvas.height - cropCircle.radius, newY));

    setCropCircle((prev) => ({ ...prev, x: newX, y: newY }));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxRadius = Math.min(canvas.width, canvas.height) / 2;
    setCropCircle((prev) => ({
      ...prev,
      radius: Math.min(prev.radius + 20, maxRadius),
    }));
  };

  const handleZoomOut = () => {
    setCropCircle((prev) => ({
      ...prev,
      radius: Math.max(prev.radius - 20, 50),
    }));
  };

  // Modified function to crop to SQUARE instead of circle
  const cropImageToSquare = async (): Promise<Blob | null> => {
    if (!hiddenImageRef.current || !canvasRef.current) return null;

    const img = hiddenImageRef.current;
    const displayCanvas = canvasRef.current;

    // Calculate scale factor between displayed image and actual image
    const scaleX = imageDimensions.width / displayCanvas.width;
    const scaleY = imageDimensions.height / displayCanvas.height;

    // Calculate the square dimensions based on the circle radius
    // The square will be the bounding box of the circle
    const diameter = cropCircle.radius * 2;
    let squareSize = diameter * Math.max(scaleX, scaleY);

    // Limit output size to max 1024x1024 for reasonable file size
    const MAX_SIZE = 1024;
    if (squareSize > MAX_SIZE) {
      squareSize = MAX_SIZE;
    }

    // Create a new canvas for the cropped SQUARE image
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = squareSize;
    cropCanvas.height = squareSize;

    const ctx = cropCanvas.getContext("2d");
    if (!ctx) return null;

    // Draw the cropped SQUARE portion from the hidden image
    // No circular clipping - just draw the square region
    ctx.drawImage(
      img,
      (cropCircle.x - cropCircle.radius) * scaleX,
      (cropCircle.y - cropCircle.radius) * scaleY,
      diameter * scaleX,
      diameter * scaleY,
      0,
      0,
      squareSize,
      squareSize
    );

    // Convert canvas to blob with quality compression
    return new Promise((resolve) => {
      cropCanvas.toBlob(
        (blob) => resolve(blob),
        "image/png" // PNG for quality
      );
    });
  };

  const handleGenerateImage = async () => {
    if (!selectedImage || !imagePrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an image and provide a prompt",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingImage(true);

    try {
      const formData = new FormData();
      formData.append("video_bot_image", selectedImage);
      formData.append("prompt", imagePrompt);

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/human/generate-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.status !== "success") {
        throw new Error(data.message || "Failed to generate image");
      }

      // Convert base64 to data URL
      const { video_bot_image_base64, video_bot_image_mime_type } = data.result;
      const imageDataUrl = `data:${video_bot_image_mime_type};base64,${video_bot_image_base64}`;

      // Store the generated image data URL for cropping
      setGeneratedImageForCrop(imageDataUrl);
      setImageLoaded(false);

      // Load image for cropping
      const img = new Image();

      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
        setImageLoaded(true);

        // Set initial circle at center with radius 1/4 of smallest dimension
        const minDim = Math.min(img.width, img.height);
        const displayWidth = 400; // Max display width
        const scale = displayWidth / img.width;
        const displayHeight = img.height * scale;

        setCropCircle({
          x: displayWidth / 2,
          y: displayHeight / 2,
          radius: Math.min(displayWidth, displayHeight) / 4,
        });

        setShowCropTool(true);
      };

      img.onerror = () => {
        console.error("Failed to load generated image");
        toast({
          title: "Image Load Error",
          description: "Failed to load the generated image. Please try again.",
          variant: "destructive",
        });
      };

      img.src = imageDataUrl;

      toast({
        title: "Image Generated",
        description: "Now select the area you want to use for the avatar",
      });

      setSelectedImage(null);
      setImagePreview(null);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleConfirmCrop = async () => {
    if (!generatedImageForCrop) return;

    setIsSavingCrop(true);

    try {
      // Use the new square cropping function instead of circular
      const croppedBlob = await cropImageToSquare();
      if (!croppedBlob) {
        throw new Error("Failed to crop image");
      }

      console.log("Cropped blob size:", croppedBlob.size, "bytes");

      // Check blob size (should be under 10MB)
      if (croppedBlob.size > 10 * 1024 * 1024) {
        throw new Error("Cropped image is too large. Please select a smaller area.");
      }

      // Upload cropped SQUARE image to Cloudinary via endpoint
      const formData = new FormData();
      formData.append("video_bot_image", croppedBlob, "avatar.png");

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/human/upload-cropped-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success !== "success") {
        throw new Error(data.message || "Failed to save cropped image");
      }

      updateConfig("videoBotImageUrl", data.result.video_bot_image_url);
      updateConfig("videoBotImagePublicId", data.result.video_bot_image_public_id);

      toast({
        title: "Success",
        description: "Video bot avatar saved successfully!",
      });

      setShowCropTool(false);
      setGeneratedImageForCrop(null);
      // Keep imagePrompt so it persists when user clears and re-uploads
      setImageLoaded(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save cropped image",
        variant: "destructive",
      });
    } finally {
      setIsSavingCrop(false);
    }
  };

  const handleCancelCrop = () => {
    setShowCropTool(false);
    setGeneratedImageForCrop(null);
    setImageLoaded(false);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Keep the prompt so user can re-upload with same prompt
    setShowCropTool(false);
    setGeneratedImageForCrop(null);
    setImageLoaded(false);

    updateConfig("videoBotImageUrl", undefined);
    updateConfig("videoBotImagePublicId", undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePreview = (voice: any) => {
    if (!voice.preview_url) return;

    if (playingVoiceId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(voice.preview_url);
    audioRef.current = audio;
    audio.play();

    setPlayingVoiceId(voice.voice_id);

    audio.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  const visibleVoices = voices.slice(0, visibleVoiceCount);
  const canShowMore = visibleVoiceCount < voices.length;
  const canShowLess = visibleVoiceCount > VOICES_PAGE_SIZE;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-primary" />
          <div>
            <Label className="text-base font-medium cursor-pointer">
              Enable Video Bot
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Enable a real-time AI video avatar for conversations.
            </p>
          </div>
        </div>
        <Switch
          checked={botConfig.isVideoBot}
          onCheckedChange={(checked) => {
            updateConfig("isVideoBot", checked);
            if (!checked) handleClearImage();
          }}
        />
      </div>

      {botConfig.isVideoBot && (
        <div className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            <Label className="text-base font-medium">
              Video Bot Avatar <span className="text-red-500">*</span>
            </Label>
          </div>

          {showCropTool && generatedImageForCrop ? (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm font-medium text-primary">Select Avatar Area</p>
                <p className="text-xs text-muted-foreground">Choose the circular area to use as your video bot avatar</p>
              </div>

              <div className="relative max-w-md mx-auto">
                {/* Hidden image for cropping */}
                <img
                  ref={hiddenImageRef}
                  src={generatedImageForCrop}
                  alt="Hidden"
                  style={{ display: 'none' }}
                  onLoad={() => setImageLoaded(true)}
                />

                {/* Visible image for display */}
                <img
                  ref={imageRef}
                  src={generatedImageForCrop}
                  alt="Generated"
                  className="w-full max-w-md rounded-lg"
                  style={{ maxHeight: "400px", objectFit: "contain" }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 cursor-move"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Drag circle to position • Use buttons to resize
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2 justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelCrop}
                  disabled={isSavingCrop}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmCrop}
                  disabled={isSavingCrop || !imageLoaded}
                >
                  {isSavingCrop ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Crop className="h-4 w-4 mr-2" />
                      Save Avatar
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : generatedImageUrl ? (
            <div className="relative max-w-md mx-auto">
              <div className="flex justify-center">
                <div className="w-40 h-40 rounded-full overflow-hidden border bg-transparent">
                  <img
                    src={generatedImageUrl}
                    alt="Video Bot Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="absolute top-2 right-2">
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={handleClearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-center text-sm text-green-600 mt-2">
                ✓ Avatar ready
              </p>
            </div>
          ) : (
            <>
              {imagePreview ? (
                <div className="flex gap-4">
                  <img
                    src={imagePreview}
                    className="w-32 h-32 object-cover rounded-lg border"
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Describe the avatar..."
                    />
                    <Button
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                      className="w-full"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Generate Avatar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg border-red-300 bg-red-50/30">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-red-600 mb-2">⚠ Avatar is required for video bot</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                </div>
              )}
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base font-medium">
              Bot Voice <span className="text-red-500">*</span>
            </Label>

            {!botConfig.voiceId && voices.length > 0 && (
              <p className="text-sm text-red-600">⚠ Please select a voice for the video bot</p>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {voicesLoading && (
                  <div className="col-span-full flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Loading voices…
                    </span>
                  </div>
                )}

                {!voicesLoading &&
                  visibleVoices.map((voice) => {
                    const isSelected = botConfig.voiceId === voice.voice_id;
                    const isPlaying = playingVoiceId === voice.voice_id;

                    return (
                      <div
                        key={voice.voice_id}
                        role="button"
                        aria-pressed={isSelected}
                        onClick={() => updateConfig("voiceId", voice.voice_id)}
                        className={`group p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "hover:border-muted-foreground/50 hover:bg-muted/30"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium leading-tight">
                              {voice.name}
                            </p>

                            {voice.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {voice.description}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              {voice.labels?.accent || "Neutral"} •{" "}
                              {voice.labels?.gender || "Unknown"}
                            </p>
                          </div>

                          {voice.preview_url && (
                            <Button
                              type="button"
                              size="icon"
                              variant={isPlaying ? "secondary" : "ghost"}
                              className="shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreview(voice);
                              }}
                            >
                              {isPlaying ? "⏸" : "▶"}
                            </Button>
                          )}
                        </div>

                        {isSelected && (
                          <div className="mt-2 text-xs text-green-600 font-medium">
                            ✓ Selected
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {!voicesLoading && voices.length > VOICES_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  {canShowMore && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setVisibleVoiceCount((prev) => prev + VOICES_PAGE_SIZE)
                      }
                    >
                      Show more
                    </Button>
                  )}

                  {canShowLess && !canShowMore && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleVoiceCount(VOICES_PAGE_SIZE)}
                    >
                      Show less
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
