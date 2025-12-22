import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage/LandingPage";
import NewDashboard from "./pages/Dashboard/NewDashboard";
import AddPatient from "./pages/Patients/AddPatient";
import PatientHistory from "./pages/PatientHistory/PatientHistory";
import SLPProfile from "./pages/SLP/SLPProfile";
import PatientRegistration from "./pages/Patients/PatientRegistration";
import AssessmentHome from "./pages/Assessments/AssessmentHome";
import RespiratoryAssessment from "./pages/Assessments/RespiratoryAssessment";
import PhonationAssessment from "./pages/Assessments/PhonationAssessment";
import SZAssessment from "./pages/Assessments/SZAssessment";
import RessonanceAndArticulationAssessment from "./pages/Assessments/RessonanceAndArticulationAssessment";
import RateOfSpeechAssessment from "./pages/Assessments/RateOfSpeechAssessment";
import ArticulationScreener from "./pages/Assessments/ArticulationScreener";
import VoiceTestAssessment from "./pages/Assessments/VoiceTestAssessment";

function App() {
  return (
    <Router>
      <Routes>

        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Dashboard Page */}
        <Route path="/dashboard" element={<NewDashboard />} />

        {/* Patient Management */}
        <Route path="/patient-registration" element={<PatientRegistration />} />
        <Route path="/patient-history/:patientId" element={<PatientHistory />} />

        {/* SLP Profile */}
        <Route path="/slp-profile" element={<SLPProfile />} />

        {/* Legacy Routes */}
        <Route path="/addpatient" element={<AddPatient />} />
        <Route path="/patienthistory" element={<PatientHistory />} />

        {/* Assessment Routes */}
        <Route path="/assessmenthome" element={<AssessmentHome />} />
        <Route path="/assess/respiratory" element={<RespiratoryAssessment />} />
        <Route path="/assess/phonation" element={<PhonationAssessment />} />
        <Route path="/assess/sz-ratio" element={<SZAssessment />} />
        <Route path="/assess/resonance" element={<RessonanceAndArticulationAssessment />} />
        <Route path="/assess/rateofspeech" element={<RateOfSpeechAssessment />} />
        <Route path="/assess/articulation" element={<ArticulationScreener />} />
        <Route path="/assess/voice" element={<VoiceTestAssessment />} />

      </Routes>
    </Router>
  );
}

export default App;
