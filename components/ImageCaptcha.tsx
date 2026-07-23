import React, { useState, useEffect } from 'react';
import { Apple, Car, Dog, Cat, Bird, Plane, Bike, Anchor, Star, Sun, Moon, Cloud, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';

const ICONS = [
  { name: 'Apple', icon: Apple },
  { name: 'Car', icon: Car },
  { name: 'Dog', icon: Dog },
  { name: 'Cat', icon: Cat },
  { name: 'Bird', icon: Bird },
  { name: 'Plane', icon: Plane },
  { name: 'Bike', icon: Bike },
  { name: 'Anchor', icon: Anchor },
  { name: 'Star', icon: Star },
  { name: 'Sun', icon: Sun },
  { name: 'Moon', icon: Moon },
  { name: 'Cloud', icon: Cloud },
];

interface ImageCaptchaProps {
  onVerify: (isValid: boolean) => void;
}

export function ImageCaptcha({ onVerify }: ImageCaptchaProps) {
  const [target, setTarget] = useState('');
  const [options, setOptions] = useState<typeof ICONS>([]);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    generateCaptcha();
  }, []);

  const generateCaptcha = () => {
    const shuffled = [...ICONS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 6);
    setOptions(selected);
    
    const randomTarget = selected[Math.floor(Math.random() * selected.length)];
    setTarget(randomTarget.name);
    setVerified(false);
    onVerify(false);
  };

  const handleSelect = (name: string) => {
    if (verified) return;
    if (name === target) {
      setVerified(true);
      onVerify(true);
    } else {
      // If they click the wrong one, regenerate to prevent brute-forcing
      generateCaptcha();
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-4 bg-muted/40 shadow-sm">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {verified ? 'Security check passed' : `Please select the ${target}`}
        </Label>
        {!verified && (
          <Button variant="ghost" size="sm" onClick={generateCaptcha} className="h-6 px-2 text-xs text-muted-foreground">
            Refresh
          </Button>
        )}
      </div>
      
      {verified ? (
        <div className="flex items-center justify-center py-5 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900/50">
          <Check className="mr-2 h-5 w-5" />
          <span className="font-medium text-sm">Verification Complete</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {options.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(opt.name)}
                className="flex h-14 items-center justify-center rounded-lg border bg-background hover:bg-muted hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label={`Select ${opt.name}`}
              >
                <Icon className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
