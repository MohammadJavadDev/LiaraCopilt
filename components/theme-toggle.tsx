"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHasMounted } from "@/hooks/use-has-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" />}
        aria-label={isDark ? "تغییر به حالت روشن" : "تغییر به حالت تاریک"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </TooltipTrigger>
      <TooltipContent>{isDark ? "حالت روشن" : "حالت تاریک"}</TooltipContent>
    </Tooltip>
  );
}
