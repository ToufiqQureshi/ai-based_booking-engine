import os
import re

file_path = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\pages\superadmin\SuperAdminDashboard.tsx"
hooks_dir = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\hooks"
components_dir = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\components\superadmin"

if not os.path.exists(hooks_dir): os.makedirs(hooks_dir)
if not os.path.exists(components_dir): os.makedirs(components_dir)

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The states are from line 187 (const { user, logout, isLoading: authLoading } = useAuth();)
# up to line 646 (const uniqueAuditActions = Array.from(new Set(auditLogs.map(log => log.action.toUpperCase())));)

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

destructure_block = "  const {\n    " + ",\n    ".join([", ".join(state_vars[i:i+6]) for i in range(0, len(state_vars), 6)]) + "\n  } = props;\n"
return_obj_block = "  return {\n    " + ",\n    ".join([", ".join(state_vars[i:i+6]) for i in range(0, len(state_vars), 6)]) + "\n  };\n"

imports_for_hook = """import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/api/client';
import { format } from 'date-fns';
"""

interfaces_block = "".join(lines[101:157])

hook_content = f"""{imports_for_hook}

{interfaces_block}

export function useSuperAdminState() {{
{"".join(lines[187:648])}
{return_obj_block}
}}
"""
with open(os.path.join(hooks_dir, "useSuperAdminState.ts"), "w", encoding='utf-8') as f:
    f.write(hook_content)

# Now Extract Tabs
imports_for_tabs = """import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Loader2, Building2, Plus, Shield, Users, Mail, Phone, Calendar, Globe, Trash2, CheckCircle2, Lock, Tag, MapPin, Edit, Settings2, BarChart3, Radio, RefreshCw, Smartphone, Key, Star, LayoutGrid, CheckSquare, XSquare, MessageSquare, ListFilter, PlayCircle, Filter, Download, Zap, UploadCloud, ChevronRight, Save, LayoutTemplate, Activity, AlertTriangle, ShieldCheck, FileText, Send, Eye, X } from 'lucide-react';
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

def write_component(name, lines_block):
    filepath = os.path.join(components_dir, f"{name}.tsx")
    content = f"""{imports_for_tabs}

export function {name}(props: any) {{
{destructure_block}
  return (
    <>
{"".join(lines_block)}
    </>
  );
}}
"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

write_component("HotelsTab", lines[837:1539])
write_component("AuditLogsTab", lines[1539:1671])
write_component("BroadcastsTab", lines[1671:1886])
write_component("AnalyticsTab", lines[1886:2114])
write_component("PlanFeaturesTab", lines[2114:2230])
write_component("QuotaModal", lines[2233:2476])
write_component("SubscriptionModal", lines[2477:2546])
write_component("AddEmployeeModal", lines[2547:2667])

# Rewrite SuperAdminDashboard.tsx
new_lines = []
i = 0
while i < len(lines):
    if i == 187:
        new_lines.append("    const stateBag = useSuperAdminState();\n")
        new_lines.append(destructure_block.replace("props", "stateBag"))
        i = 648
    elif i == 837:
        new_lines.append('                    <HotelsTab {...stateBag} />\n')
        new_lines.append('                    <AuditLogsTab {...stateBag} />\n')
        new_lines.append('                    <BroadcastsTab {...stateBag} />\n')
        new_lines.append('                    <AnalyticsTab {...stateBag} />\n')
        new_lines.append('                    <PlanFeaturesTab {...stateBag} />\n')
        i = 2230
    elif i == 2233:
        new_lines.append('                <QuotaModal {...stateBag} />\n')
        i = 2476
    elif i == 2477:
        new_lines.append('                <SubscriptionModal {...stateBag} />\n')
        i = 2546
    elif i == 2547:
        new_lines.append('                <AddEmployeeModal {...stateBag} />\n')
        i = 2667
    else:
        new_lines.append(lines[i])
        i += 1

# Insert imports
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
new_lines.insert(107, extra_imports)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Super extraction complete!")
