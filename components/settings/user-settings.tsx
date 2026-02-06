"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlusIcon as UserPlus, ShieldCheckIcon as Shield, EnvelopeIcon as Mail, EllipsisHorizontalIcon as MoreHorizontal, TrashIcon as Trash2, PencilIcon as Edit } from "@heroicons/react/24/outline"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TeamMember {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "advisor" | "technician"
  status: "active" | "pending"
  lastActive: string
}

const teamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Mike Johnson",
    email: "mike@downtownauto.com",
    role: "owner",
    status: "active",
    lastActive: "Now",
  },
  {
    id: "2",
    name: "Sarah Williams",
    email: "sarah@downtownauto.com",
    role: "admin",
    status: "active",
    lastActive: "2 hours ago",
  },
  {
    id: "3",
    name: "Carlos Rodriguez",
    email: "carlos@downtownauto.com",
    role: "advisor",
    status: "active",
    lastActive: "15 minutes ago",
  },
  {
    id: "4",
    name: "Emily Chen",
    email: "emily@downtownauto.com",
    role: "advisor",
    status: "active",
    lastActive: "1 hour ago",
  },
  {
    id: "5",
    name: "James Thompson",
    email: "james@downtownauto.com",
    role: "technician",
    status: "pending",
    lastActive: "Invited",
  },
]

const rolePermissions = {
  owner: ["All permissions", "Billing access", "Delete shop"],
  admin: ["Manage team", "View analytics", "Configure integrations"],
  advisor: ["Create ROs", "Message customers", "View reports"],
  technician: ["Update RO status", "Log time", "View assigned ROs"],
}

export function UserSettings() {
  const [members] = useState(teamMembers)
  const [inviteOpen, setInviteOpen] = useState(false)

  const getRoleBadge = (role: TeamMember["role"]) => {
    const styles = {
      owner: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
      admin: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
      advisor: "bg-green-500/20 text-green-700 dark:text-green-400",
      technician: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    }
    return <Badge className={styles[role]}>{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
            <p className="text-sm text-muted-foreground">{members.length} members in your shop</p>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus size={16} className="mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>Send an invitation to join your shop on RO Engine.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input id="invite-email" type="email" placeholder="colleague@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select defaultValue="advisor">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="advisor">Service Advisor</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Permissions Preview</Label>
                  <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                    {rolePermissions.advisor.map((perm) => (
                      <p key={perm} className="text-sm text-muted-foreground flex items-center gap-2">
                        <Shield size={12} className="text-accent" />
                        {perm}
                      </p>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={() => setInviteOpen(false)}>
                  <Mail size={16} className="mr-2" />
                  Send Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center text-white font-semibold">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden md:block">{member.lastActive}</span>
                {getRoleBadge(member.role)}
                {member.status === "pending" && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Pending
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit size={14} className="mr-2" />
                      Edit Role
                    </DropdownMenuItem>
                    {member.role !== "owner" && (
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 size={14} className="mr-2" />
                        Remove
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Role Permissions */}
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(rolePermissions) as [keyof typeof rolePermissions, string[]][]).map(([role, perms]) => (
            <div key={role} className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="mb-3">{getRoleBadge(role)}</div>
              <ul className="space-y-2">
                {perms.map((perm) => (
                  <li key={perm} className="text-sm text-muted-foreground flex items-start gap-2">
                    <Shield size={12} className="text-accent mt-1 shrink-0" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Security Settings */}
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">Require 2FA for all team members</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">Session Timeout</p>
              <p className="text-sm text-muted-foreground">Automatically log out after inactivity</p>
            </div>
            <Select defaultValue="8">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">IP Allowlist</p>
              <p className="text-sm text-muted-foreground">Restrict access to specific IP addresses</p>
            </div>
            <Switch />
          </div>
        </div>
      </Card>
    </div>
  )
}
