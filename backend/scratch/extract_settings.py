import os

settings_file = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\pages\settings\Settings.tsx"
components_dir = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\components\settings"

with open(settings_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def write_component(name, props, lines_block):
    filepath = os.path.join(components_dir, f"{name}.tsx")
    imports = """import { Save, Loader2, Globe, Palette, Upload, Image, Mail, MessageSquare, Shield, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
"""
    content = f"""{imports}

export function {name}({{ {props} }}: any) {{
  const {{ toast }} = useToast();
  return (
    <>
{"".join(lines_block)}
    </>
  );
}}
"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Extract sections
# GeneralTab: lines 228 to 462
write_component("GeneralTab", "formData, handleUpdate, handleSave, isSaving, hotel", lines[228:463])

# BrandingTab: lines 522 to 704
write_component("BrandingTab", "formData, handleUpdate, handleSave, isSaving, setIsSaving, hotel", lines[522:705])

# EmailTab: lines 705 to 845
write_component("EmailTab", "formData, handleUpdate, handleSave, isSaving, hotel", lines[705:846])

# PoliciesTab: lines 899 to 1013
write_component("PoliciesTab", "formData, handleUpdate, handleSave, isSaving, hotel", lines[899:1014])

new_lines = []
i = 0
while i < len(lines):
    if i == 228: 
        new_lines.append('          <GeneralTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} hotel={hotel} />\n')
        i = 463
    elif i == 522: 
        new_lines.append('          <BrandingTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} setIsSaving={setIsSaving} hotel={hotel} />\n')
        i = 705
    elif i == 705: 
        new_lines.append('          <EmailTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} hotel={hotel} />\n')
        i = 846
    elif i == 899: 
        new_lines.append('          <PoliciesTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} hotel={hotel} />\n')
        i = 1014
    else:
        new_lines.append(lines[i])
        i += 1

import_str = """import { GeneralTab } from '@/components/settings/GeneralTab';
import { BrandingTab } from '@/components/settings/BrandingTab';
import { EmailTab } from '@/components/settings/EmailTab';
import { PoliciesTab } from '@/components/settings/PoliciesTab';
"""
new_lines.insert(28, import_str) 

with open(settings_file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Extraction complete!")
