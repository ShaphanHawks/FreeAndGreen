import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface ConfirmationProps {
  data: {
    pickup: any;
    message: string;
  };
}

export default function Confirmation({ data }: ConfirmationProps) {
  const handleNewPickup = () => {
    window.location.href = "/schedule";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-green-600 mb-4">
            <CheckCircle className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">Pickup Scheduled!</h3>
          <p className="text-green-700">
            {data.message}
          </p>
          <p className="text-sm text-green-600 mt-2">You'll receive an SMS confirmation shortly.</p>
          
          <div className="mt-6">
            <Button 
              onClick={handleNewPickup}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Schedule Another Pickup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
