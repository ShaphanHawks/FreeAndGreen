import { useQuery, useMutation, queryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { CalendarCheck, Clock, CheckCircle, LogOut } from "lucide-react";
import type { Pickup } from "@shared/schema";

export default function CrewDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ["/api/crew/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: pickups = [], isLoading } = useQuery<Pickup[]>({
    queryKey: ["/api/crew/pickups"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/crew/logout");
    },
    onSuccess: () => {
      setLocation("/crew/login");
    },
  });

  const completePickupMutation = useMutation({
    mutationFn: async (pickupId: number) => {
      const response = await apiRequest("POST", `/api/crew/complete/${pickupId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pickup Completed",
        description: "Pickup marked as completed successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crew/pickups"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete pickup",
        variant: "destructive",
      });
    },
  });

  if (!profile) {
    setLocation("/crew/login");
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleCompletePickup = (pickupId: number) => {
    if (confirm("Mark this pickup as completed?")) {
      completePickupMutation.mutate(pickupId);
    }
  };

  const todayPickups = pickups.filter(p => {
    const today = new Date().toISOString().split('T')[0];
    return p.scheduled_date === today;
  });

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-slate-50 rounded-lg p-6 mb-12 border border-slate-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">My Assigned Pickups</h2>
              <p className="text-sm text-slate-600 mt-1">
                Logged in as: <span className="font-medium text-slate-800">{profile.display_name}</span>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                <Clock className="w-4 h-4 mr-2" />
                {pickups.length} Scheduled
              </span>
              <button 
                onClick={handleLogout}
                className="text-slate-600 hover:text-slate-800"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Pickups List */}
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">Loading pickups...</div>
            ) : pickups.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-900 mb-2">No Scheduled Pickups</h4>
                <p className="text-slate-600">You're all caught up! New assignments will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pickups.map((pickup) => (
                  <div key={pickup.id} className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 mr-3">
                            {pickup.status}
                          </span>
                          <span className="text-sm text-slate-500">
                            ID: #{pickup.id}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium text-slate-700">Date & Time</p>
                            <p className="text-slate-900">
                              {pickup.scheduled_date}<br />
                              <span className="text-sm text-slate-600">{pickup.scheduled_timeslot}</span>
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-slate-700">Address</p>
                            <p className="text-slate-900">{pickup.address}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {pickup.status === "Scheduled" ? (
                        <button 
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          onClick={() => handleCompletePickup(pickup.id)}
                          disabled={completePickupMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-2 inline" />
                          Mark Completed
                        </button>
                      ) : (
                        <span className="text-sm text-slate-500">Completed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
