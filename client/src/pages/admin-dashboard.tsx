import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCrewSchema, insertZipAssignmentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  CalendarDays, 
  TriangleAlert, 
  Users, 
  CheckCircle, 
  LogOut,
  Plus,
  Download,
  Edit,
  Trash2,
  ClipboardList,
  UserCog,
  Route
} from "lucide-react";
import type { Crew, Pickup, ZipAssignment } from "@shared/schema";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [isCrewDialogOpen, setIsCrewDialogOpen] = useState(false);
  const [isZipRouteDialogOpen, setIsZipRouteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    crewId: "",
    status: "",
  });

  const { toast } = useToast();

  // Check if user is authenticated
  const { data: stats } = useQuery<{
    todayPickups: number;
    unassignedPickups: number;
    completedThisWeek: number;
    activeCrews: number;
  } | null>({
    queryKey: ["/api/admin/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: crews = [] } = useQuery<Crew[]>({
    queryKey: ["/api/admin/crews"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: pickups = [] } = useQuery<(Pickup & { crew_email?: string })[]>({
    queryKey: ["/api/admin/pickups", filters],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: zipRoutes = [] } = useQuery<(ZipAssignment & { crew_display_name: string })[]>({
    queryKey: ["/api/admin/zip-routes"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (!stats) {
    setLocation("/admin/login");
    return null;
  }

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      setLocation("/admin/login");
    },
  });

  const createCrewForm = useForm({
    resolver: zodResolver(insertCrewSchema),
    defaultValues: {
      email: "",
      password: "",
      display_name: "",
      zip_prefixes: [],
    },
  });

  const createZipRouteForm = useForm({
    resolver: zodResolver(insertZipAssignmentSchema),
    defaultValues: {
      zip_prefix: "",
      crew_id: 0,
    },
  });

  const createCrewMutation = useMutation({
    mutationFn: async (data: any) => {
      // Process zip_prefixes if it's a string
      if (typeof data.zip_prefixes === 'string') {
        data.zip_prefixes = data.zip_prefixes.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      const response = await apiRequest("POST", "/api/admin/crews", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Crew created successfully!" });
      setIsCrewDialogOpen(false);
      createCrewForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crews"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create crew",
        variant: "destructive",
      });
    },
  });

  const createZipRouteMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/zip-routes", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "ZIP route created successfully!" });
      setIsZipRouteDialogOpen(false);
      createZipRouteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zip-routes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ZIP route",
        variant: "destructive",
      });
    },
  });

  const deleteCrewMutation = useMutation({
    mutationFn: async (crewId: number) => {
      await apiRequest("DELETE", `/api/admin/crews/${crewId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Crew deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crews"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete crew",
        variant: "destructive",
      });
    },
  });

  const deleteZipRouteMutation = useMutation({
    mutationFn: async (zipRouteId: number) => {
      await apiRequest("DELETE", `/api/admin/zip-routes/${zipRouteId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "ZIP route deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zip-routes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete ZIP route",
        variant: "destructive",
      });
    },
  });

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    window.open(`/api/admin/pickups/export?${params.toString()}`, '_blank');
  };

  const handleDeleteCrew = (crewId: number, crewName: string) => {
    if (confirm(`Are you sure you want to delete "${crewName}"?`)) {
      deleteCrewMutation.mutate(crewId);
    }
  };

  const handleDeleteZipRoute = (zipRouteId: number, zipPrefix: string) => {
    if (confirm(`Are you sure you want to delete the route for ZIP prefix "${zipPrefix}"?`)) {
      deleteZipRouteMutation.mutate(zipRouteId);
    }
  };

  return (
    <div className="bg-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h2>
              <p className="text-slate-600 mt-1">System Overview and Management</p>
            </div>
            <div className="text-right">
              <button 
                onClick={() => logoutMutation.mutate()}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700 transition-colors"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-4 h-4 inline mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{stats.todayPickups}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-900">Today's Pickups</p>
                <p className="text-xs text-blue-700">Scheduled for today</p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{stats.unassignedPickups}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-900">Unassigned</p>
                <p className="text-xs text-yellow-700">Need crew assignment</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{stats.completedThisWeek}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-900">Completed</p>
                <p className="text-xs text-green-700">This week</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-slate-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{stats.activeCrews}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-900">Active Crews</p>
                <p className="text-xs text-slate-700">Total crews</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <a href="#pickups" className="block bg-slate-50 rounded-lg p-6 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <div className="flex items-center">
              <ClipboardList className="h-8 w-8 text-blue-600 mr-4" />
              <div>
                <h4 className="font-semibold text-slate-900">View All Pickups</h4>
                <p className="text-sm text-slate-600">Manage and assign pickups</p>
              </div>
            </div>
          </a>
          
          <a href="#crews" className="block bg-slate-50 rounded-lg p-6 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <div className="flex items-center">
              <UserCog className="h-8 w-8 text-blue-600 mr-4" />
              <div>
                <h4 className="font-semibold text-slate-900">Manage Crews</h4>
                <p className="text-sm text-slate-600">Add, edit, or remove crews</p>
              </div>
            </div>
          </a>
          
          <a href="#zip-routing" className="block bg-slate-50 rounded-lg p-6 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <div className="flex items-center">
              <Route className="h-8 w-8 text-blue-600 mr-4" />
              <div>
                <h4 className="font-semibold text-slate-900">ZIP Routing</h4>
                <p className="text-sm text-slate-600">Configure automatic assignments</p>
              </div>
            </div>
          </a>
        </div>

        {/* All Pickups Management */}
        <div className="bg-white rounded-xl shadow-lg mb-8" id="pickups">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <h4 className="text-xl font-semibold text-slate-900">All Pickups</h4>
              <button 
                onClick={handleExportCSV}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4 mr-2 inline" />
                Export CSV
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Crew</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  value={filters.crewId}
                  onChange={(e) => setFilters(prev => ({ ...prev, crewId: e.target.value }))}
                >
                  <option value="">All Crews</option>
                  {crews.map((crew) => (
                    <option key={crew.id} value={crew.id.toString()}>{crew.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/pickups"] })}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
          
          {/* Pickups Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Crew</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {pickups.map((pickup) => (
                  <tr key={pickup.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">#{pickup.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{pickup.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{pickup.scheduled_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{pickup.scheduled_timeslot}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{pickup.crew_email || "Unassigned"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pickup.status === "Completed" 
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {pickup.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">Assign</button>
                      <button className="text-slate-600 hover:text-slate-900">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Crew Management */}
        <div className="bg-white rounded-xl shadow-lg mb-8" id="crews">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <h4 className="text-xl font-semibold text-slate-900">Manage Crews</h4>
              <Dialog open={isCrewDialogOpen} onOpenChange={setIsCrewDialogOpen}>
                <DialogTrigger asChild>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                    <Plus className="w-4 h-4 mr-2 inline" />
                    Add New Crew
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Crew</DialogTitle>
                  </DialogHeader>
                  <Form {...createCrewForm}>
                    <form onSubmit={createCrewForm.handleSubmit((data) => createCrewMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={createCrewForm.control}
                        name="display_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., North Side Crew" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createCrewForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="crew@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createCrewForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter secure password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          ZIP Prefixes (comma-separated)
                        </label>
                        <Input
                          placeholder="e.g., 627, 628, 629"
                          onChange={(e) => createCrewForm.setValue('zip_prefixes', e.target.value as any)}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Enter ZIP code prefixes that should auto-assign to this crew, separated by commas.
                        </p>
                      </div>
                      <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsCrewDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createCrewMutation.isPending}>
                          {createCrewMutation.isPending ? "Creating..." : "Create Crew"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {crews.map((crew) => (
                <div key={crew.id} className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-semibold text-slate-900 mb-2">{crew.display_name}</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Email: <span className="text-slate-900">{crew.email}</span></p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">ZIP Prefixes:</p>
                          <div className="flex flex-wrap gap-1">
                            {crew.zip_prefixes?.map((zip, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">{zip}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">Edit</button>
                      <button 
                        onClick={() => handleDeleteCrew(crew.id, crew.display_name)}
                        className="text-red-600 hover:text-red-900 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ZIP Routing */}
        <div className="bg-white rounded-xl shadow-lg mb-8" id="zip-routing">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <h4 className="text-xl font-semibold text-slate-900">ZIP Code Routing</h4>
              <Dialog open={isZipRouteDialogOpen} onOpenChange={setIsZipRouteDialogOpen}>
                <DialogTrigger asChild>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                    <Plus className="w-4 h-4 mr-2 inline" />
                    Add Route
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add ZIP Route</DialogTitle>
                  </DialogHeader>
                  <Form {...createZipRouteForm}>
                    <form onSubmit={createZipRouteForm.handleSubmit((data) => createZipRouteMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={createZipRouteForm.control}
                        name="zip_prefix"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Prefix</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 627" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createZipRouteForm.control}
                        name="crew_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assign to Crew</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a crew" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {crews.map((crew) => (
                                  <SelectItem key={crew.id} value={crew.id.toString()}>
                                    {crew.display_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsZipRouteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createZipRouteMutation.isPending}>
                          {createZipRouteMutation.isPending ? "Creating..." : "Create Route"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ZIP Prefix</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned Crew</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {zipRoutes.map((route) => (
                    <tr key={route.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{route.zip_prefix}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">{route.crew_display_name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => handleDeleteZipRoute(route.id, route.zip_prefix)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
