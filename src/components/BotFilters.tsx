import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Search, Filter, X, ChevronDown, Mic, Video, Users } from "lucide-react";

interface BotFiltersProps {
  onFiltersChange: (filters: BotFilterState) => void;
  totalBots: number;
  filteredCount: number;
}

export interface BotFilterState {
  searchQuery: string;
  primaryPurpose: string;
  conversationalTone: string;
  voiceEnabled: string;
  isVideoBot: string;
  humanHandoffEnabled: string;
}

const initialFilters: BotFilterState = {
  searchQuery: "",
  primaryPurpose: "all",
  conversationalTone: "all",
  voiceEnabled: "all",
  isVideoBot: "all",
  humanHandoffEnabled: "all",
};

const purposeOptions = [
  { value: "all", label: "All Purposes" },
  { value: "customer-support", label: "Customer Support" },
  { value: "sales", label: "Sales" },
  { value: "lead-generation", label: "Lead Generation" },
  { value: "information", label: "Information" },
  { value: "booking", label: "Booking" },
  { value: "other", label: "Other" },
];

const toneOptions = [
  { value: "all", label: "All Tones" },
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
];

export const BotFilters = ({ onFiltersChange, totalBots, filteredCount }: BotFiltersProps) => {
  const [filters, setFilters] = useState<BotFilterState>(initialFilters);
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof BotFilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    onFiltersChange(initialFilters);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "searchQuery" && value !== "all"
  ).length;

  const hasActiveFilters = activeFilterCount > 0 || filters.searchQuery !== "";

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bots by name..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter("searchQuery", e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="h-11 gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-11 w-11">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Primary Purpose */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Purpose</label>
                <Select value={filters.primaryPurpose} onValueChange={(v) => updateFilter("primaryPurpose", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {purposeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conversational Tone */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tone</label>
                <Select value={filters.conversationalTone} onValueChange={(v) => updateFilter("conversationalTone", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Enabled */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Voice
                </label>
                <Select value={filters.voiceEnabled} onValueChange={(v) => updateFilter("voiceEnabled", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Voice enabled" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Video Bot */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video Bot
                </label>
                <Select value={filters.isVideoBot} onValueChange={(v) => updateFilter("isVideoBot", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Video bot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Video Bots</SelectItem>
                    <SelectItem value="false">Normal Bots</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Human Handoff */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Human Handoff
                </label>
                <Select value={filters.humanHandoffEnabled} onValueChange={(v) => updateFilter("humanHandoffEnabled", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Human handoff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Active:</span>
                {filters.searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: "{filters.searchQuery}"
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter("searchQuery", "")}
                    />
                  </Badge>
                )}
                {filters.primaryPurpose !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {purposeOptions.find(o => o.value === filters.primaryPurpose)?.label}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter("primaryPurpose", "all")}
                    />
                  </Badge>
                )}
                {filters.conversationalTone !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {toneOptions.find(o => o.value === filters.conversationalTone)?.label}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter("conversationalTone", "all")}
                    />
                  </Badge>
                )}
                {filters.voiceEnabled !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Voice: {filters.voiceEnabled === "true" ? "On" : "Off"}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter("voiceEnabled", "all")}
                    />
                  </Badge>
                )}
                {filters.isVideoBot !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {filters.isVideoBot === "true" ? "Video Bot" : "Normal Bot"}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter("isVideoBot", "all")}
                    />
                  </Badge>
                )}
                {filters.humanHandoffEnabled !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Handoff: {filters.humanHandoffEnabled === "true" ? "On" : "Off"}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter("humanHandoffEnabled", "all")}
                    />
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Results Count */}
      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredCount} of {totalBots} bots
        </p>
      )}
    </div>
  );
};
