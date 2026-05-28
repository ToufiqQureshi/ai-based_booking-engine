with open('src/pages/public/BookingWidget.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

modern_lines = lines[449:816]
classic_lines = lines[816:896]
minimal_lines = lines[896:965]
premium_lines = lines[965:1037]

state_vars = [
    'config', 'setConfig', 'startingPrice', 'setStartingPrice',
    'checkInDate', 'setCheckInDate', 'checkOutDate', 'setCheckOutDate',
    'roomsCount', 'setRoomsCount', 'adults', 'setAdults',
    'children', 'setChildren', 'promoCode', 'setPromoCode',
    'isCalendarOpen', 'setIsCalendarOpen', 'isGuestOpen', 'setIsGuestOpen',
    'isMobile', 'setIsMobile', 'handleSearch', 'updateParentIframeHeight',
    'primaryHex', 'bgColor', 'isBgLight', 'widgetTheme', 'layout'
]
destructure_block = '    const {\n        ' + ',\n        '.join([', '.join(state_vars[i:i+6]) for i in range(0, len(state_vars), 6)]) + '\n    } = props;\n'

imports = '''import React from 'react';
import { format } from 'date-fns';
import { Search, Calendar as CalendarIcon, Users, ChevronDown, Minus, Plus, ArrowRight, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
'''

def write_component(name, body_lines):
    with open(f'src/components/public/{name}.tsx', 'w', encoding='utf-8') as f:
        f.write(imports)
        f.write(f'\nexport function {name}(props: any) {{\n')
        f.write(destructure_block)
        f.write('    return (\n        <>\n')
        f.writelines(body_lines)
        f.write('        </>\n    );\n}\n')

write_component('ModernFloatingLayout', modern_lines)
write_component('ClassicStackedLayout', classic_lines)
write_component('MinimalBarLayout', minimal_lines)
write_component('PremiumCapsuleLayout', premium_lines)

# Reconstruct BookingWidget.tsx
new_widget = lines[:14]
new_widget.extend([
    "import { useBookingWidgetState } from '@/hooks/useBookingWidgetState';\n",
    "import { ModernFloatingLayout } from '@/components/public/ModernFloatingLayout';\n",
    "import { ClassicStackedLayout } from '@/components/public/ClassicStackedLayout';\n",
    "import { MinimalBarLayout } from '@/components/public/MinimalBarLayout';\n",
    "import { PremiumCapsuleLayout } from '@/components/public/PremiumCapsuleLayout';\n\n",
    "export default function BookingWidget() {\n",
    "    const stateBag = useBookingWidgetState();\n"
])
new_widget.append(destructure_block.replace('props', 'stateBag'))
new_widget.extend(lines[345:449]) # Up to layouts
new_widget.extend([
    "            {layout === 'modern' && <ModernFloatingLayout {...stateBag} />}\n",
    "            {layout === 'classic' && <ClassicStackedLayout {...stateBag} />}\n",
    "            {layout === 'minimal' && <MinimalBarLayout {...stateBag} />}\n",
    "            {layout === 'premium' && <PremiumCapsuleLayout {...stateBag} />}\n"
])
new_widget.extend(lines[1037:])

with open('src/pages/public/BookingWidget.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_widget)

print('BookingWidget UI extracted!')
