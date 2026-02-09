import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getAgentAuthHeaders, getAgentEmail } from "@/utils/agentAuth";
import {
  ArrowLeft,
  Headphones,
  User,
  Phone,
  Clock,
  Bell,
  Zap,
  Save,
  Loader2,
  Camera,
  Plus,
  X,
  Globe,
} from "lucide-react";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

type DayKey = typeof DAYS[number]["key"];

interface WorkingHours {
  [key: string]: { start: string; end: string; enabled: boolean };
}

interface AgentProfile {
  displayName: string;
  avatarUrl: string;
  phoneNumber: string;
  availabilityStatus: "available" | "busy" | "away" | "offline";
  timezone: string;
  skills: string[];
  workingHours: WorkingHours;
  emailNotifications: boolean;
  soundNotifications: boolean;
  autoAcceptChats: boolean;
}

const defaultWorkingHours: WorkingHours = {
  monday: { start: "09:00", end: "17:00", enabled: true },
  tuesday: { start: "09:00", end: "17:00", enabled: true },
  wednesday: { start: "09:00", end: "17:00", enabled: true },
  thursday: { start: "09:00", end: "17:00", enabled: true },
  friday: { start: "09:00", end: "17:00", enabled: true },
  saturday: { start: "09:00", end: "17:00", enabled: false },
  sunday: { start: "09:00", end: "17:00", enabled: false },
};

const AgentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");

  const [profile, setProfile] = useState<AgentProfile>({
    displayName: "",
    avatarUrl: "",
    phoneNumber: "",
    availabilityStatus: "offline",
    timezone: "UTC",
    skills: [],
    workingHours: defaultWorkingHours,
    emailNotifications: true,
    soundNotifications: true,
    autoAcceptChats: false,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/human-agent/profile`,
        {
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setProfile({
            displayName: data.result.displayName || "",
            avatarUrl: data.result.avatarUrl || "",
            phoneNumber: data.result.phoneNumber || "",
            availabilityStatus: data.result.availabilityStatus || "offline",
            timezone: data.result.timezone || "UTC",
            skills: data.result.skills || [],
            workingHours: data.result.workingHours || defaultWorkingHours,
            emailNotifications: data.result.emailNotifications ?? true,
            soundNotifications: data.result.soundNotifications ?? true,
            autoAcceptChats: data.result.autoAcceptChats ?? false,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/human-agent/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
          body: JSON.stringify(profile),
        }
      );

      if (response.ok) {
        toast({
          title: "Profile Updated",
          description: "Your profile has been saved successfully.",
        });
      } else {
        throw new Error("Failed to save profile");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()],
      }));
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const updateWorkingHours = (
    day: DayKey,
    field: "start" | "end" | "enabled",
    value: string | boolean
  ) => {
    setProfile((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: {
          ...prev.workingHours[day],
          [field]: value,
        },
      },
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "busy":
        return "bg-red-500";
      case "away":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/agent")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Headphones className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Profile Settings</h1>
                  <p className="text-sm text-muted-foreground">
                    Manage your agent profile
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="general" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Skills</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your display name, avatar, and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                      <AvatarImage src={profile.avatarUrl} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {profile.displayName?.charAt(0)?.toUpperCase() ||
                          getAgentEmail()?.charAt(0)?.toUpperCase() ||
                          "A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 p-1.5 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                      <Camera className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="avatarUrl">Avatar URL</Label>
                    <Input
                      id="avatarUrl"
                      placeholder="https://example.com/avatar.jpg"
                      value={profile.avatarUrl}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          avatarUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="Enter your display name"
                    value={profile.displayName}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        displayName: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      placeholder="+1 (555) 000-0000"
                      className="pl-10"
                      value={profile.phoneNumber}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          phoneNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Availability Status */}
                <div className="space-y-2">
                  <Label>Availability Status</Label>
                  <Select
                    value={profile.availabilityStatus}
                    onValueChange={(value: AgentProfile["availabilityStatus"]) =>
                      setProfile((prev) => ({
                        ...prev,
                        availabilityStatus: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          Available
                        </div>
                      </SelectItem>
                      <SelectItem value="busy">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          Busy
                        </div>
                      </SelectItem>
                      <SelectItem value="away">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-yellow-500" />
                          Away
                        </div>
                      </SelectItem>
                      <SelectItem value="offline">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-gray-500" />
                          Offline
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select
                      value={profile.timezone}
                      onValueChange={(value) =>
                        setProfile((prev) => ({ ...prev, timezone: value }))
                      }
                    >
                      <SelectTrigger className="pl-10">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Working Hours</CardTitle>
                <CardDescription>
                  Set your availability schedule for each day of the week
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {DAYS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center gap-4 py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3 w-32">
                      <Checkbox
                        id={`${key}-enabled`}
                        checked={profile.workingHours[key]?.enabled ?? false}
                        onCheckedChange={(checked) =>
                          updateWorkingHours(key, "enabled", checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`${key}-enabled`}
                        className={
                          !profile.workingHours[key]?.enabled
                            ? "text-muted-foreground"
                            : ""
                        }
                      >
                        {label}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={profile.workingHours[key]?.start || "09:00"}
                        onChange={(e) =>
                          updateWorkingHours(key, "start", e.target.value)
                        }
                        disabled={!profile.workingHours[key]?.enabled}
                        className="w-auto"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={profile.workingHours[key]?.end || "17:00"}
                        onChange={(e) =>
                          updateWorkingHours(key, "end", e.target.value)
                        }
                        disabled={!profile.workingHours[key]?.enabled}
                        className="w-auto"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Skills & Specializations</CardTitle>
                <CardDescription>
                  Add your areas of expertise for better chat routing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a skill (e.g., Technical Support, Sales)"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button onClick={addSkill} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[100px] p-4 bg-muted/50 rounded-lg">
                  {profile.skills.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No skills added yet. Add skills to help with chat routing.
                    </p>
                  ) : (
                    profile.skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="gap-1 py-1.5 px-3"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="ml-1 hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="space-y-0.5">
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email alerts for new chat assignments
                    </p>
                  </div>
                  <Switch
                    checked={profile.emailNotifications}
                    onCheckedChange={(checked) =>
                      setProfile((prev) => ({
                        ...prev,
                        emailNotifications: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="space-y-0.5">
                    <Label className="text-base">Sound Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Play a sound when new messages arrive
                    </p>
                  </div>
                  <Switch
                    checked={profile.soundNotifications}
                    onCheckedChange={(checked) =>
                      setProfile((prev) => ({
                        ...prev,
                        soundNotifications: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-Accept Chats</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically accept incoming chat requests
                    </p>
                  </div>
                  <Switch
                    checked={profile.autoAcceptChats}
                    onCheckedChange={(checked) =>
                      setProfile((prev) => ({
                        ...prev,
                        autoAcceptChats: checked,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Branding */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <span className="font-semibold text-primary">TasteAI Studio</span>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AgentProfile;
