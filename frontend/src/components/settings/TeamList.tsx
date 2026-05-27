import { useState, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';

export function TeamList() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserName, setAddUserName] = useState('');
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserPassword, setAddUserPassword] = useState('');
  const [addUserRole, setAddUserRole] = useState('STAFF');
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      const data = await apiClient.get<any[]>('/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch team:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async () => {
    if (!addUserName || !addUserEmail || !addUserPassword) {
      toast({ title: 'Missing fields', description: 'Please fill out all fields.', variant: 'destructive' });
      return;
    }
    try {
      setIsAdding(true);
      await apiClient.post('/users', {
        name: addUserName,
        email: addUserEmail,
        password: addUserPassword,
        role: addUserRole
      });
      toast({ title: 'User Added', description: 'Team member has been successfully added.' });
      setIsAddUserOpen(false);
      setAddUserName('');
      setAddUserEmail('');
      setAddUserPassword('');
      setAddUserRole('STAFF');
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Failed to add user', description: error.message || 'An error occurred', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading team...</div>;

  return (
    <div className="space-y-4">
      {users.map(u => (
        <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {u.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-muted-foreground">{u.email}</p>
            </div>
          </div>
          <div className="text-sm font-medium text-primary">{u.role}</div>
        </div>
      ))}
      
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            <Users className="h-4 w-4" />
            Add Team Member
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Create a new account for your staff or manager.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={addUserName} onChange={(e) => setAddUserName(e.target.value)} placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={addUserEmail} onChange={(e) => setAddUserEmail(e.target.value)} placeholder="e.g. frontdesk@hotel.com" />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input type="password" value={addUserPassword} onChange={(e) => setAddUserPassword(e.target.value)} placeholder="Must be at least 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={addUserRole} onValueChange={setAddUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff (Front Desk)</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} disabled={isAdding}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={isAdding}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
