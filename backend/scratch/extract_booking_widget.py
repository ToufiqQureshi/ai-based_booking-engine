import os

file_path = 'src/pages/public/BookingWidget.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

hooks_dir = 'src/hooks'
components_dir = 'src/components/public'
os.makedirs(hooks_dir, exist_ok=True)
os.makedirs(components_dir, exist_ok=True)

# Find boundaries
state_start = content.find('    const [config, setConfig] =')
state_end = content.find('    return (')

modern_start = content.find('{/* 1. MODERN FLOATING CARD LAYOUT (DEFAULT) */}')
classic_start = content.find('{/* 2. CLASSIC STACKED LAYOUT */}')
minimal_start = content.find('{/* 3. MINIMAL BAR LAYOUT */}')
premium_start = content.find('{/* 4. PREMIUM CAPSULE LAYOUT */}')

# </div> matching for the end of premium layout. The end of return is `</div`
# Let's find the `</form>` or `</div>` that ends the premium layout.
main_return_end = content.find('        </div>\\n    );\\n}\\n')

blocks = {
    'ModernFloatingLayout': content[modern_start:classic_start],
    'ClassicStackedLayout': content[classic_start:minimal_start],
    'MinimalBarLayout': content[minimal_start:premium_start],
    'PremiumCapsuleLayout': content[premium_start:main_return_end]
}

state_vars = [
    "config", "setConfig",
    "startingPrice", "setStartingPrice",
    "checkInDate", "setCheckInDate",
    "checkOutDate", "setCheckOutDate",
    "roomsCount", "setRoomsCount",
    "adults", "setAdults",
    "children", "setChildren",
    "promoCode", "setPromoCode",
    "isCalendarOpen", "setIsCalendarOpen",
    "isGuestOpen", "setIsGuestOpen",
    "isMobile", "setIsMobile",
    "handleSearch", "updateParentIframeHeight",
    "primaryHex", "bgColor", "isBgLight", "widgetTheme", "layout"
]

destructure_block = "  const {\\n    " + ",\\n    ".join([", ".join(state_vars[i:i+6]) for i in range(0, len(state_vars), 6)]) + "\\n  } = props;\\n"
return_obj_block = "  return {\\n    " + ",\\n    ".join([", ".join(state_vars[i:i+6]) for i in range(0, len(state_vars), 6)]) + "\\n  };\\n"

imports_for_components = """import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Loader2, Building2, Plus, Shield, Users, Mail, Phone, Calendar as CalendarIcon, Globe, Trash2, CheckCircle2, Lock, Tag, MapPin, Edit, Settings2, BarChart3, Radio, RefreshCw, Smartphone, Key, Star, LayoutGrid, CheckSquare, XSquare, MessageSquare, ListFilter, PlayCircle, Filter, Download, Zap, UploadCloud, ChevronRight, Save, LayoutTemplate, Activity, AlertTriangle, ShieldCheck, FileText, Send, Eye, X, Crown, Clock, Copy, ArrowRight, UserCheck, CheckCircle, SlidersHorizontal, Settings, ChevronDown, Minus } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
"""

for name, block in blocks.items():
    filepath = os.path.join(components_dir, f"{name}.tsx")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(imports_for_components + f"\\nexport function {name}(props: any) {{\n{destructure_block}  return (\\n    <>\\n{block}\\n    </>\\n  );\\n}}")

# Now rebuild BookingWidget.tsx
new_widget = (
    content[:modern_start] +
    "            {layout === 'modern' && <ModernFloatingLayout {...stateBag} />}\\n" +
    "            {layout === 'classic' && <ClassicStackedLayout {...stateBag} />}\\n" +
    "            {layout === 'minimal' && <MinimalBarLayout {...stateBag} />}\\n" +
    "            {layout === 'premium' && <PremiumCapsuleLayout {...stateBag} />}\\n" +
    content[main_return_end:]
)

extra_imports = """import { useBookingWidgetState } from '@/hooks/useBookingWidgetState';
import { ModernFloatingLayout } from '@/components/public/ModernFloatingLayout';
import { ClassicStackedLayout } from '@/components/public/ClassicStackedLayout';
import { MinimalBarLayout } from '@/components/public/MinimalBarLayout';
import { PremiumCapsuleLayout } from '@/components/public/PremiumCapsuleLayout';
"""

# Insert extra imports right after lucide-react
lucide_end = new_widget.find("} from 'lucide-react';")
if lucide_end != -1:
    insert_idx = new_widget.find('\\n', lucide_end) + 1
    new_widget = new_widget[:insert_idx] + extra_imports + new_widget[insert_idx:]

if state_start != -1 and state_end != -1:
    hook_body = new_widget[state_start:state_end]
    
    hook_content = f"""import {{ useState, useEffect, useRef }} from 'react';
import {{ format, addDays }} from 'date-fns';
import {{ apiClient }} from '@/api/client';
import {{ useTheme }} from '@/contexts/ThemeContext';

export function useBookingWidgetState() {{
    const searchParams = new URLSearchParams(window.location.search);
    const hotelId = searchParams.get('hotelId') || window.location.pathname.split('/').pop() || '';
    const initialCheckIn = searchParams.get('checkIn');
    const initialCheckOut = searchParams.get('checkOut');
    const initialAdults = searchParams.get('adults');
    const initialRooms = searchParams.get('rooms');
    const initialTheme = searchParams.get('theme') || 'light';
    const widgetLayout = searchParams.get('layout') || 'modern';
{hook_body}
{return_obj_block}
}}
"""
    with open(os.path.join(hooks_dir, "useBookingWidgetState.tsx"), "w", encoding='utf-8') as f:
        f.write(hook_content)

    new_widget = (
        new_widget[:new_widget.find('export default function BookingWidget() {') + len('export default function BookingWidget() {')] +
        "\\n    const stateBag = useBookingWidgetState();\\n" +
        destructure_block.replace("props", "stateBag") +
        "\\n    const widgetRef = useRef<HTMLDivElement>(null);\\n" +
        new_widget[state_end:]
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_widget)

print("Extraction complete via robust string slice!")
