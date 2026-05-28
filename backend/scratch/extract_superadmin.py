import os
import re

superadmin_file = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\pages\superadmin\SuperAdminDashboard.tsx"
components_dir = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\components\superadmin"

if not os.path.exists(components_dir):
    os.makedirs(components_dir)

with open(superadmin_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

destructure_block = """  const {
    user, logout, authLoading, theme, toggleTheme,
    selectedWorkspaceHotel, setSelectedWorkspaceHotel,
    workspaceTab, setWorkspaceTab,
    workspacePermissions, setWorkspacePermissions,
    editedPlanFeatures, setEditedPlanFeatures,
    searchQuery, setSearchQuery,
    userSearchQuery, setUserSearchQuery,
    selectedQuotaHotel, setSelectedQuotaHotel,
    whatsappCredits, setWhatsappCredits,
    smsCredits, setSmsCredits,
    aiUsageLimit, setAiUsageLimit,
    broadcastTitle, setBroadcastTitle,
    broadcastMessage, setBroadcastMessage,
    broadcastType, setBroadcastType,
    isAddUserOpen, setIsAddUserOpen,
    addUserEmail, setAddUserEmail,
    addUserName, setAddUserName,
    addUserPassword, setAddUserPassword,
    addUserRole, setAddUserRole,
    statusFilter, setStatusFilter,
    planFilter, setPlanFilter,
    featureFilterAI, setFeatureFilterAI,
    featureFilterBot, setFeatureFilterBot,
    featureFilterRates, setFeatureFilterRates,
    detailHotel, setDetailHotel,
    selectedSubHotel, setSelectedSubHotel,
    subPlanName, setSubPlanName,
    subStatus, setSubStatus,
    subEndDate, setSubEndDate,
    auditSearchQuery, setAuditSearchQuery,
    auditActionFilter, setAuditActionFilter,
    toast, queryClient,
    hotels, isLoading, refetch,
    users, isLoadingUsers,
    auditLogs, isLoadingAudit, refetchAudit,
    broadcasts, isLoadingBroadcasts, refetchBroadcasts,
    planFeatures, isLoadingPlanFeatures, refetchPlanFeatures,
    activeDetailHotel,
    updateWorkspacePermissionsMutation,
    toggleFeatureMutation,
    updateQuotaMutation,
    deletePropertyMutation,
    toggleSubMutation,
    handleSaveEditedPlanFeatures,
    savePlanFeaturesMutation,
    createBroadcastMutation,
    deleteBroadcastMutation,
    addUserMutation,
    updateUserStatusMutation,
    toggleUserStatusMutation,
    deleteUserMutation,
    getInitials,
    filteredHotels,
    filteredAuditLogs
  } = props;
"""

imports_block = """import React from 'react';
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
    content = f"""{imports_block}

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

# line numbers (0-indexed)
# 837 to 1538 = hotels
# 1539 to 1670 = audit
# 1671 to 1885 = broadcasts
# 1886 to 2113 = analytics
# 2114 to 2664 = plan-features

write_component("HotelsTab", lines[837:1539])
write_component("AuditLogsTab", lines[1539:1671])
write_component("BroadcastsTab", lines[1671:1886])
write_component("AnalyticsTab", lines[1886:2114])
write_component("PlanFeaturesTab", lines[2114:2665])

new_lines = []
i = 0
while i < len(lines):
    if i == 837:
        new_lines.append('                    <HotelsTab {...stateBag} />\n')
        i = 1539
    elif i == 1539:
        new_lines.append('                    <AuditLogsTab {...stateBag} />\n')
        i = 1671
    elif i == 1671:
        new_lines.append('                    <BroadcastsTab {...stateBag} />\n')
        i = 1886
    elif i == 1886:
        new_lines.append('                    <AnalyticsTab {...stateBag} />\n')
        i = 2114
    elif i == 2114:
        new_lines.append('                    <PlanFeaturesTab {...stateBag} />\n')
        i = 2665
    else:
        new_lines.append(lines[i])
        i += 1

state_bag = """
    const stateBag = {
        user, logout, authLoading, theme, toggleTheme,
        selectedWorkspaceHotel, setSelectedWorkspaceHotel,
        workspaceTab, setWorkspaceTab,
        workspacePermissions, setWorkspacePermissions,
        editedPlanFeatures, setEditedPlanFeatures,
        searchQuery, setSearchQuery,
        userSearchQuery, setUserSearchQuery,
        selectedQuotaHotel, setSelectedQuotaHotel,
        whatsappCredits, setWhatsappCredits,
        smsCredits, setSmsCredits,
        aiUsageLimit, setAiUsageLimit,
        broadcastTitle, setBroadcastTitle,
        broadcastMessage, setBroadcastMessage,
        broadcastType, setBroadcastType,
        isAddUserOpen, setIsAddUserOpen,
        addUserEmail, setAddUserEmail,
        addUserName, setAddUserName,
        addUserPassword, setAddUserPassword,
        addUserRole, setAddUserRole,
        statusFilter, setStatusFilter,
        planFilter, setPlanFilter,
        featureFilterAI, setFeatureFilterAI,
        featureFilterBot, setFeatureFilterBot,
        featureFilterRates, setFeatureFilterRates,
        detailHotel, setDetailHotel,
        selectedSubHotel, setSelectedSubHotel,
        subPlanName, setSubPlanName,
        subStatus, setSubStatus,
        subEndDate, setSubEndDate,
        auditSearchQuery, setAuditSearchQuery,
        auditActionFilter, setAuditActionFilter,
        toast, queryClient,
        hotels, isLoading, refetch,
        users, isLoadingUsers,
        auditLogs, isLoadingAudit, refetchAudit,
        broadcasts, isLoadingBroadcasts, refetchBroadcasts,
        planFeatures, isLoadingPlanFeatures, refetchPlanFeatures,
        activeDetailHotel,
        updateWorkspacePermissionsMutation,
        toggleFeatureMutation,
        updateQuotaMutation,
        deletePropertyMutation,
        toggleSubMutation,
        handleSaveEditedPlanFeatures,
        savePlanFeaturesMutation,
        createBroadcastMutation,
        deleteBroadcastMutation,
        addUserMutation,
        updateUserStatusMutation,
        toggleUserStatusMutation,
        deleteUserMutation,
        getInitials,
        filteredHotels,
        filteredAuditLogs
    };
"""

# Insert state_bag just before return statement (line 817)
# Insert imports at the top
imports_str = """
import { HotelsTab } from '@/components/superadmin/HotelsTab';
import { AuditLogsTab } from '@/components/superadmin/AuditLogsTab';
import { BroadcastsTab } from '@/components/superadmin/BroadcastsTab';
import { AnalyticsTab } from '@/components/superadmin/AnalyticsTab';
import { PlanFeaturesTab } from '@/components/superadmin/PlanFeaturesTab';
"""

# We'll inject the state bag manually where appropriate.
# The return statement is at line 818 -> <div className={cn("min-h-screen", theme === 'dark' ? 'dark' : '')}>
# We can inject it right after the `const filteredAuditLogs` declaration.
for j, line in enumerate(new_lines):
    if "const filteredAuditLogs =" in line:
        new_lines.insert(j + 5, state_bag)
        break

new_lines.insert(25, imports_str)

with open(superadmin_file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Extraction complete!")
