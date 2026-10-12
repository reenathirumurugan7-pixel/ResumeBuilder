import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { TemplateProvider } from './context/TemplateContext'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import PageTransition from './components/PageTransition'
import FloatingActionButtons from './components/FloatingActionButtons'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { SkeletonResume } from './components/Skeleton'
// Home and Login stay in the initial bundle so the landing page and the sign-in
// screen paint without waiting on a second round-trip. Every other page is
// fetched on demand, which keeps the heavy editor/vault/export code (and the
// libraries it pulls in) out of the initial download.
import Home from './pages/Home'
import Login from './pages/Login'

const About = lazy(() => import('./pages/About'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const Features = lazy(() => import('./pages/Features'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Templates = lazy(() => import('./pages/Templates'))
const ResumeType = lazy(() => import('./pages/ResumeType'))
const CustomizeTemplate = lazy(() => import('./pages/CustomizeTemplate'))
const FresherEditor = lazy(() => import('./pages/FresherEditor'))
const ExperiencedEditor = lazy(() => import('./pages/ExperiencedEditor'))
const PublicResume = lazy(() => import('./pages/PublicResume'))
const ResumeVault = lazy(() => import('./pages/ResumeVault'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const EnhanceResume = lazy(() => import('./pages/EnhanceResume'))
const JobMatcher = lazy(() => import('./pages/JobMatcher'))
const Settings = lazy(() => import('./pages/Settings'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminResumes = lazy(() => import('./pages/admin/AdminResumes'))
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'))
const AdminTemplates = lazy(() => import('./pages/admin/AdminTemplates'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const NotFound = lazy(() => import('./pages/NotFound'))

function PageLoader() {
  return (
    <div className="container" style={{ padding: '48px 0' }}>
      <SkeletonResume />
    </div>
  )
}

// `PageTransition` clones this component with the location the user is leaving,
// so that layer keeps rendering the outgoing page while it animates out. That
// only works if `Routes` (not the Suspense boundary) receives the `location`
// prop, hence the wrapper instead of inlining Suspense around <Routes>.
function AppRoutes({ location }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/login" element={<Login />} />
        <Route path="/features" element={<Features />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/customize/:templateId" element={<CustomizeTemplate />} />
        <Route path="/resume-type" element={<ResumeType />} />
        <Route
          path="/resume-vault"
          element={
            <ProtectedRoute>
              <ResumeVault />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/enhance" element={<EnhanceResume />} />
        <Route
          path="/job-matcher"
          element={
            <ProtectedRoute>
              <JobMatcher />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        {/* The single AdminRoute around the layout already guards the whole
            subtree: it renders AdminLayout (and therefore the nested <Outlet/>)
            only for a signed-in user whose verified token carries the admin
            claim. The child pages need no second guard. */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="resumes" element={<AdminResumes />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="/editor/fresher" element={<FresherEditor />} />
        <Route path="/editor/experienced" element={<ExperiencedEditor />} />
        <Route path="/resume/:resumeId" element={<PublicResume />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <AuthProvider>
      <TemplateProvider>
        <Router>
          <Navbar />
          <main style={{ flex: 1 }}>
            <PageTransition>
              <AppRoutes />
            </PageTransition>
          </main>
          <FloatingActionButtons />
          <Footer />
        </Router>
      </TemplateProvider>
    </AuthProvider>
  )
}

export default App