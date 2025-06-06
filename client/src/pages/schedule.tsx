import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schedulePickupSchema, type SchedulePickupForm } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Confirmation from "@/components/confirmation";
import { Truck, MapPin, Calendar, Clock } from "lucide-react";

export default function Schedule() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<SchedulePickupForm>({
    resolver: zodResolver(schedulePickupSchema),
    defaultValues: {
      address: "",
      desired_date: "",
      timeslot: "" as any,
    },
  });

  const schedulePickupMutation = useMutation({
    mutationFn: async (data: SchedulePickupForm) => {
      const response = await apiRequest("POST", "/api/schedule", data);
      return response.json();
    },
    onSuccess: (data) => {
      setConfirmationData(data);
      setIsSubmitted(true);
      toast({
        title: "Pickup Scheduled",
        description: "Your pickup has been scheduled successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule pickup",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SchedulePickupForm) => {
    schedulePickupMutation.mutate(data);
  };

  if (isSubmitted && confirmationData) {
    return <Confirmation data={confirmationData} />;
  }

  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-slate-800">Pickup Scheduler</h1>
            </div>
            <div className="hidden md:flex space-x-6">
              <a href="/schedule" className="text-blue-600 font-medium transition-colors">Schedule Pickup</a>
              <a href="/crew/login" className="text-slate-600 hover:text-blue-600 transition-colors">Crew Login</a>
              <a href="/admin/login" className="text-slate-600 hover:text-blue-600 transition-colors">Admin</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Schedule Your Appliance Pickup</h2>
          <p className="text-lg text-slate-600">Simple, fast, and reliable pickup scheduling</p>
        </div>
        
        <Card className="bg-white rounded-xl shadow-lg">
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                        <MapPin className="inline w-4 h-4 text-blue-600 mr-2" />
                        Pickup Address
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter your complete address including street, city, state, and ZIP code"
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="desired_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                        <Calendar className="inline w-4 h-4 text-blue-600 mr-2" />
                        Desired Date
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          min={today}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeslot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700 mb-2">
                        <Clock className="inline w-4 h-4 text-blue-600 mr-2" />
                        Preferred Time Slot
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                            <SelectValue placeholder="Select a time slot" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="8 AM–10 AM">8 AM – 10 AM</SelectItem>
                          <SelectItem value="10 AM–12 PM">10 AM – 12 PM</SelectItem>
                          <SelectItem value="12 PM–2 PM">12 PM – 2 PM</SelectItem>
                          <SelectItem value="2 PM–4 PM">2 PM – 4 PM</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  disabled={schedulePickupMutation.isPending}
                >
                  {schedulePickupMutation.isPending ? "Scheduling..." : "Schedule Pickup"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
