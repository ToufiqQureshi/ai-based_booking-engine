import os

file_path = 'src/pages/superadmin/SuperAdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

hooks_dir = 'src/hooks'
components_dir = 'src/components/superadmin'
os.makedirs(hooks_dir, exist_ok=True)
os.makedirs(components_dir, exist_ok=True)

# Find boundaries by string matching on the FULL file content
hotels_start = content.find('<TabsContent value="hotels"')
audit_start = content.find('<TabsContent value="audit"')
broadcasts_start = content.find('<TabsContent value="broadcasts"')
analytics_start = content.find('<TabsContent value="analytics"')
plan_features_start = content.find('<TabsContent value="plan-features"')
tabs_end = content.find('</Tabs>')
quota_start = content.find('<Dialog open={!!selectedQuotaHotel}')
sub_start = content.find('<Dialog open={!!selectedSubHotel}')
add_user_start = content.find('<Dialog open={isAddUserOpen}')
main_end = content.find('</main>')

blocks = {
    'HotelsTab': content[hotels_start:audit_start],
    'AuditLogsTab': content[audit_start:broadcasts_start],
    'BroadcastsTab': content[broadcasts_start:analytics_start],
    'AnalyticsTab': content[analytics_start:plan_features_start],
    'PlanFeaturesTab': content[plan_features_start:tabs_end],
    'QuotaModal': content[quota_start:sub_start],
    'SubscriptionModal': content[sub_start:add_user_start],
    'AddEmployeeModal': content[add_user_start:main_end],
}

state_vars = [
    "user", "logout", "authLoading", "theme", "toggleTheme",
    "selectedWorkspaceHotel", "setSelectedWorkspaceHotel",
    "workspaceTab", "setWorkspaceTab",
    "workspacePermissions", "setWorkspacePermissions",
    "editedPlanFeatures", "setEditedPlanFeatures",
    "searchQuery", "setSearchQuery",
    "userSearchQuery", "setUserSearchQuery",
    "selectedQuotaHotel", "setSelectedQuotaHotel",
    "whatsappCredits", "setWhatsappCredits",
    "smsCredits", "setSmsCredits",
    "aiUsageLimit", "setAiUsageLimit",
    "broadcastTitle", "setBroadcastTitle",
    "broadcastMessage", "setBroadcastMessage",
    "broadcastType", "setBroadcastType",
    "isAddUserOpen", "setIsAddUserOpen",
    "addUserEmail", "setAddUserEmail",
    "addUserName", "setAddUserName",
    "addUserPassword", "setAddUserPassword",
    "addUserRole", "setAddUserRole",
    "statusFilter", "setStatusFilter",
    "planFilter", "setPlanFilter",
    "featureFilterAI", "setFeatureFilterAI",
    "featureFilterBot", "setFeatureFilterBot",
    "featureFilterRates", "setFeatureFilterRates",
    "detailHotel", "setDetailHotel",
    "selectedSubHotel", "setSelectedSubHotel",
    "subPlanName", "setSubPlanName",
    "subStatus", "setSubStatus",
    "subEndDate", "setSubEndDate",
    "auditSearchQuery", "setAuditSearchQuery",
    "auditActionFilter", "setAuditActionFilter",
    "toast", "queryClient",
    "hotels", "isLoading", "refetch",
    "users", "isLoadingUsers",
    "auditLogs", "isLoadingAudit", "refetchAudit",
    "broadcasts", "isLoadingBroadcasts", "refetchBroadcasts",
    "planFeatures", "isLoadingPlanFeatures", "refetchPlanFeatures",
    "activeDetailHotel",
    "updateWorkspacePermissionsMutation",
    "toggleFeatureMutation",
    "updateQuotaMutation",
    "deletePropertyMutation",
    "toggleSubMutation",
    "handleSaveEditedPlanFeatures",
    "savePlanFeaturesMutation",
    "createBroadcastMutation",
    "deleteBroadcastMutation",
    "addUserMutation",
    "updateUserStatusMutation",
    "toggleUserStatusMutation",
    "deleteUserMutation",
    "getInitials",
    "filteredHotels",
    "filteredAuditLogs",
    "uniqueAuditActions"
]

destructure_block = "  const {\\n    " + ",\\n    ".join([", ".join(state_vars[i:i+6]) for i in range(0, len(state_vars), 6)]) + "\\n  } = props;\\n"
return_obj_block = "  return {\\n    " + ",\\n    ".join([", ".join(state_vars[i:i+6]) for i in range(0, len(state_vars), 6)]) + "\\n  };\\n"

imports_for_tabs = """import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Loader2, Building2, Plus, Shield, Users, Mail, Phone, Calendar, Globe, Trash2, CheckCircle2, Lock, Tag, MapPin, Edit, Settings2, BarChart3, Radio, RefreshCw, Smartphone, Key, Star, LayoutGrid, CheckSquare, XSquare, MessageSquare, ListFilter, PlayCircle, Filter, Download, Zap, UploadCloud, ChevronRight, Save, LayoutTemplate, Activity, AlertTriangle, ShieldCheck, FileText, Send, Eye, X, Crown, Clock, Copy, ArrowRight, UserCheck, CheckCircle, SlidersHorizontal, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
"""

def write_component(name, block_content):
    filepath = os.path.join(components_dir, f"{name}.tsx")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(imports_for_tabs + f"\\nexport function {name}(props: any) {{\n{destructure_block}  return (\\n    <>\\n{block_content}\\n    </>\\n  );\\n}}")

for name, block in blocks.items():
    write_component(name, block)

# Now rebuild SuperAdminDashboard.tsx
# Everything before hotels_start, then the new tags, then from tabs_end to quota_start, then the new tags, then from main_end to end.
new_dashboard = (
    content[:hotels_start] +
    "                    <HotelsTab {...stateBag} />\\n" +
    "                    <AuditLogsTab {...stateBag} />\\n" +
    "                    <BroadcastsTab {...stateBag} />\\n" +
    "                    <AnalyticsTab {...stateBag} />\\n" +
    "                    <PlanFeaturesTab {...stateBag} />\\n                " +
    content[tabs_end:quota_start] +
    "                <QuotaModal {...stateBag} />\\n" +
    "                <SubscriptionModal {...stateBag} />\\n" +
    "                <AddEmployeeModal {...stateBag} />\\n            " +
    content[main_end:]
)

extra_imports = """import { useSuperAdminState } from '@/hooks/useSuperAdminState';
import { HotelsTab } from '@/components/superadmin/HotelsTab';
import { AuditLogsTab } from '@/components/superadmin/AuditLogsTab';
import { BroadcastsTab } from '@/components/superadmin/BroadcastsTab';
import { AnalyticsTab } from '@/components/superadmin/AnalyticsTab';
import { PlanFeaturesTab } from '@/components/superadmin/PlanFeaturesTab';
import { QuotaModal } from '@/components/superadmin/QuotaModal';
import { SubscriptionModal } from '@/components/superadmin/SubscriptionModal';
import { AddEmployeeModal } from '@/components/superadmin/AddEmployeeModal';
"""

# Insert extra imports right after lucide-react
lucide_end = new_dashboard.find("} from 'lucide-react';")
if lucide_end != -1:
    insert_idx = new_dashboard.find('\\n', lucide_end) + 1
    new_dashboard = new_dashboard[:insert_idx] + extra_imports + new_dashboard[insert_idx:]

# Extract state hook
state_start = new_dashboard.find('const { user, logout, isLoading: authLoading } = useAuth();')
state_end = new_dashboard.find('const uniqueAuditActions = Array.from(new Set(auditLogs.map(log => log.action.toUpperCase())));')
if state_end != -1:
    state_end = new_dashboard.find('\\n', state_end) + 1

if state_start != -1 and state_end != -1:
    hook_body = new_dashboard[state_start:state_end]
    
    # Filter out early returns (authLoading and !user)
    hook_body_lines = hook_body.split('\\n')
    filtered_hook_lines = []
    in_early = False
    early_returns = []
    for line in hook_body_lines:
        if 'if (authLoading)' in line or 'if (!user' in line:
            in_early = True
        if in_early:
            early_returns.append(line)
            if line.strip() == '}':
                in_early = False
            continue
        filtered_hook_lines.append(line)
    
    hook_body = "\\n".join(filtered_hook_lines)

    interfaces_block = content[content.find('interface HotelAdminData'):content.find('const DEFAULT_ROLE_PERMISSIONS')]
    
    hook_content = f"""import {{ useState, useEffect }} from 'react';
import {{ useQuery, useMutation, useQueryClient }} from '@tanstack/react-query';
import {{ useAuth }} from '@/contexts/AuthContext';
import {{ useTheme }} from '@/contexts/ThemeContext';
import {{ useToast }} from '@/components/ui/use-toast';
import {{ apiClient }} from '@/api/client';
import {{ format }} from 'date-fns';

{interfaces_block}

export function useSuperAdminState() {{
{hook_body}
{return_obj_block}
}}
"""
    with open(os.path.join(hooks_dir, "useSuperAdminState.tsx"), "w", encoding='utf-8') as f:
        f.write(hook_content)

    new_dashboard = (
        new_dashboard[:state_start] +
        "    const stateBag = useSuperAdminState();\\n" +
        destructure_block.replace("props", "stateBag") +
        "\\n".join(early_returns) + "\\n" +
        new_dashboard[state_end:]
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_dashboard)

print("Super extraction complete via robust string slice!")
