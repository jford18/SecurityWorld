
import React, { useState } from 'react';
import { View } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardHome from './views/DashboardHome';
import TechnicalFailures from './views/TechnicalFailures';
import Intrusions from './views/Intrusions';
import DeviceStatus from './views/DeviceStatus';
import SystemLogs from './views/SystemLogs';
import TechnicalExplanation from './views/TechnicalExplanation';
import AlertsReportByShift from './views/AlertsReportByShift';

const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);

  const renderView = () => {
    switch (currentView) {
      case View.Dashboard:
        return <DashboardHome />;
      case View.Failures:
        return <TechnicalFailures />;
      case View.Intrusions:
        return <Intrusions />;
      case View.Devices:
        return <DeviceStatus />;
      case View.Logs:
        return <SystemLogs />;
      case View.AlertsReport:
        return <AlertsReportByShift />;
      case View.Architecture:
        return <TechnicalExplanation />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F6F8]">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F5F6F8]">
          <div className="container mx-auto px-6 py-8">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
