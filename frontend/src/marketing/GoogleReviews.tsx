// Google Reviews — Per-Hotel Connect + AI Reply Studio
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Star, Sparkles, Send, RefreshCw, ChevronDown, ChevronUp,
  MessageSquare, Search, Filter, AlertCircle, CheckCircle2,
  ThumbsUp, Loader2, ExternalLink, Unplug, Link2,
  Building2, ShieldCheck, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
interface GoogleStatus {
  connected: boolean;
  email: string | null;
  account_id: string | null;
  location_id: string | null;
}

interface ReviewReply {
  comment: string;
  updateTime: string;
}

interface Review {
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName: string;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: ReviewReply;
}

const STAR_MAP: Record<Review['starRating'], number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

const RATING_COLORS: Record<number, string> = {
  1: 'text-red-500', 2: 'text-orange-500', 3: 'text-yellow-500',
  4: 'text-blue-500', 5: 'text-emerald-500',
};

const RATING_BG: Record<number, string> = {
  1: 'bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900',
  2: 'bg-orange-50 border-orange-100 dark:bg-orange-950/40 dark:border-orange-900',
  3: 'bg-yellow-50 border-yellow-100 dark:bg-yellow-950/40 dark:border-yellow-900',
  4: 'bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900',
  5: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900',
};

const RATING_LABELS: Record<number, string> = {
  1: 'Very Negative', 2: 'Negative', 3: 'Neutral', 4: 'Positive', 5: 'Excellent',
};

const FILTER_OPTIONS = ['all', 'unanswered', 'answered', '5★', '4★', '3★', '2★', '1★'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

// ─── Google logo SVG ──────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// ─── Star Display ─────────────────────────────────────────────────────────────
const StarRating = ({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        className={cn(
          size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5',
          i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'
        )}
      />
    ))}
  </div>
);

// ─── Connect Banner ───────────────────────────────────────────────────────────
const ConnectBanner = ({
  onConnect,
  connecting,
}: {
  onConnect: () => void;
  connecting: boolean;
}) => (
  <div className="min-h-[70vh] flex items-center justify-center p-6">
    <div className="max-w-lg w-full">
      {/* Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

        <div className="p-8 text-center">
          {/* Google icon + hotel icon */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
              <Building2 className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn('w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600', i === 1 && 'bg-indigo-400')} />
              ))}
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
              <GoogleIcon />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Connect Google Business Profile
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Connect <strong>your hotel's</strong> Google account to fetch real reviews and reply to them using AI — directly from this dashboard.
          </p>

          {/* Feature list */}
          <div className="grid grid-cols-1 gap-3 mb-8 text-left">
            {[
              { icon: Star, text: 'Fetch all your Google Business reviews automatically', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
              { icon: Sparkles, text: 'Generate AI-powered personalized replies in one click', color: 'text-violet-500 bg-violet-50 dark:bg-violet-950' },
              { icon: Send, text: 'Post replies directly to Google — no app switching', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
              { icon: ShieldCheck, text: 'Only your hotel\'s account is linked — fully isolated', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={onConnect}
            disabled={connecting}
            className="w-full gap-3 h-12 text-base bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {connecting ? 'Redirecting to Google...' : 'Sign in with Google'}
          </Button>

          <p className="text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Each hotel connects its own Google account. Your data is never shared between hotels.
          </p>
        </div>
      </div>
    </div>
  </div>
);

// ─── Connected Header ─────────────────────────────────────────────────────────
const ConnectedHeader = ({
  status,
  onDisconnect,
  disconnecting,
  onRefresh,
  refreshing,
  reviewCount,
}: {
  status: GoogleStatus;
  onDisconnect: () => void;
  disconnecting: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  reviewCount: number;
}) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
          <GoogleIcon />
        </div>
        Google Reviews
      </h1>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Connected</span>
        </div>
        {status.email && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            as <strong className="text-slate-700 dark:text-slate-300">{status.email}</strong>
          </span>
        )}
        <span className="text-xs text-slate-400">· {reviewCount} reviews</span>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="gap-2 h-8 text-xs"
      >
        <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onDisconnect}
        disabled={disconnecting}
        className="gap-2 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950"
      >
        {disconnecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Unplug className="w-3.5 h-3.5" />
        )}
        Disconnect
      </Button>
    </div>
  </div>
);

// ─── Stats Bar ────────────────────────────────────────────────────────────────
const StatsBar = ({ reviews }: { reviews: Review[] }) => {
  const total = reviews.length;
  const answered = reviews.filter(r => r.reviewReply).length;
  const pending = total - answered;
  const avgRating = total
    ? (reviews.reduce((s, r) => s + STAR_MAP[r.starRating], 0) / total).toFixed(1)
    : '—';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total Reviews', value: total, icon: Star, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 border-amber-100 dark:border-amber-900' },
        { label: 'Avg. Rating', value: avgRating, icon: ThumbsUp, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60 border-blue-100 dark:border-blue-900' },
        { label: 'Replied', value: answered, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-900' },
        { label: 'Awaiting Reply', value: pending, icon: AlertCircle, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 border-amber-100 dark:border-amber-900' },
      ].map(stat => (
        <div key={stat.label} className={cn(
          'rounded-2xl border p-4 flex items-center gap-3',
          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        )}>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', stat.color)}>
            <stat.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Review Card ──────────────────────────────────────────────────────────────
const ReviewCard = ({
  review,
  onGenerateReply,
  onPostReply,
}: {
  review: Review;
  onGenerateReply: (review: Review) => Promise<string>;
  onPostReply: (review: Review, reply: string) => Promise<void>;
}) => {
  const rating = STAR_MAP[review.starRating];
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState(review.reviewReply?.comment || '');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [localReply, setLocalReply] = useState(review.reviewReply?.comment || '');
  const [showEditor, setShowEditor] = useState(false);

  const initials = review.reviewer.displayName?.slice(0, 2).toUpperCase() || 'GU';

  const handleGenerate = async () => {
    setAiGenerating(true);
    setShowEditor(true);
    try {
      const generated = await onGenerateReply(review);
      setReplyText(generated);
    } finally {
      setAiGenerating(false);
    }
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      await onPostReply(review, replyText);
      setLocalReply(replyText);
      setShowEditor(false);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={cn(
      'group rounded-2xl border transition-all duration-200',
      'bg-white dark:bg-slate-900',
      localReply
        ? 'border-l-4 border-l-emerald-400 border-r border-t border-b border-slate-200 dark:border-slate-800'
        : rating <= 2
          ? 'border-l-4 border-l-red-400 border-r border-t border-b border-slate-200 dark:border-slate-800'
          : 'border border-slate-200 dark:border-slate-800',
      'hover:shadow-md'
    )}>
      <div className="p-5 flex items-start gap-4">
        <Avatar className="w-11 h-11 ring-2 ring-slate-100 dark:ring-slate-800 flex-shrink-0">
          <AvatarImage src={review.reviewer.profilePhotoUrl} />
          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white text-sm">
                {review.reviewer.displayName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <StarRating rating={rating} />
                <span className={cn('text-xs font-medium', RATING_COLORS[rating])}>
                  {RATING_LABELS[rating]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {localReply ? (
                <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950 gap-1 text-xs">
                  <CheckCircle2 className="w-3 h-3" /> Replied
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 gap-1 text-xs">
                  <MessageSquare className="w-3 h-3" /> Pending
                </Badge>
              )}
              <span className="text-xs text-slate-400">
                {new Date(review.createTime).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review text */}
      {review.comment ? (
        <div className="px-5 pb-4">
          <p className={cn(
            'text-sm text-slate-600 dark:text-slate-400 leading-relaxed',
            !expanded && review.comment.length > 200 && 'line-clamp-3'
          )}>
            {review.comment}
          </p>
          {review.comment.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-indigo-500 hover:text-indigo-700 mt-1 flex items-center gap-1"
            >
              {expanded
                ? <><ChevronUp className="w-3 h-3" />Show less</>
                : <><ChevronDown className="w-3 h-3" />Read more</>}
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 pb-4">
          <p className="text-xs text-slate-400 italic">No written review — star rating only.</p>
        </div>
      )}

      {/* Existing reply preview */}
      {localReply && !showEditor && (
        <div className="mx-5 mb-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Your Reply</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{localReply}</p>
          <button
            onClick={() => { setReplyText(localReply); setShowEditor(true); }}
            className="text-xs text-indigo-500 hover:text-indigo-700 mt-2"
          >
            Edit reply
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 pb-5 flex items-center gap-2 flex-wrap">
        {!showEditor && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={aiGenerating}
              className="gap-1.5 text-xs h-8 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950"
            >
              {aiGenerating
                ? <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
                : <><Sparkles className="w-3 h-3" />AI Reply</>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setReplyText(localReply || ''); setShowEditor(true); }}
              className="gap-1.5 text-xs h-8 text-slate-600 dark:text-slate-400"
            >
              <MessageSquare className="w-3 h-3" />
              {localReply ? 'Edit Reply' : 'Write Reply'}
            </Button>
          </>
        )}
        {showEditor && (
          <Button size="sm" variant="ghost" onClick={() => setShowEditor(false)} className="text-xs h-8 text-slate-500">
            Cancel
          </Button>
        )}
      </div>

      {/* Reply editor */}
      {showEditor && (
        <div className="px-5 pb-5">
          <Textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder={aiGenerating ? 'Generating your AI reply...' : 'Write your reply or click AI Reply to auto-generate...'}
            rows={4}
            disabled={aiGenerating}
            className="resize-none text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-400">{replyText.length} chars</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={aiGenerating}
                className="gap-1.5 text-xs h-8"
              >
                {aiGenerating
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Sparkles className="w-3 h-3 text-violet-500" />}
                Regenerate
              </Button>
              <Button
                size="sm"
                onClick={handlePost}
                disabled={posting || !replyText.trim() || aiGenerating}
                className="gap-1.5 text-xs h-8 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
              >
                {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Post to Google
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 bg-white dark:bg-slate-900">
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse flex-shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="h-4 w-1/3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      </div>
    </div>
    <div className="h-14 bg-slate-50 dark:bg-slate-800/60 rounded-xl animate-pulse" />
    <div className="flex gap-2">
      <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
      <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GoogleReviews() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  // ── Handle OAuth callback params from Google ──────────────────────────────
  useEffect(() => {
    const status = searchParams.get('google_status');
    if (status === 'success') {
      toast({ title: '🎉 Google Business Profile connected!', description: 'Your reviews are loading now.' });
      setSearchParams({}, { replace: true });
    } else if (status === 'error') {
      const msg = searchParams.get('message') || 'Unknown error';
      toast({ title: 'Google connection failed', description: msg, variant: 'destructive' });
      setSearchParams({}, { replace: true });
    }
  }, []);

  // ── Fetch connection status ───────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await apiClient.get<GoogleStatus>('/integration/google/status');
      setGoogleStatus(data);
    } catch {
      setGoogleStatus({ connected: false, email: null, account_id: null, location_id: null });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Fetch reviews (only if connected) ────────────────────────────────────
  const fetchReviews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setReviewsLoading(true);
    try {
      const data = await apiClient.get<{ reviews: Review[] }>('/integration/google/reviews');
      setReviews(data.reviews || []);
    } catch (err: any) {
      toast({
        title: 'Failed to fetch reviews',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReviewsLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (googleStatus?.connected) fetchReviews();
  }, [googleStatus?.connected]);

  // ── Connect / Disconnect ──────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Call via apiClient so JWT token is sent in Authorization header
      const data = await apiClient.get<{ auth_url: string }>('/integration/google/connect');
      // Now redirect browser to Google OAuth consent screen
      window.location.href = data.auth_url;
    } catch (err: any) {
      toast({
        title: 'Failed to start Google connection',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };


  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Business Profile? You can reconnect anytime.')) return;
    setDisconnecting(true);
    try {
      await apiClient.delete('/integration/google/disconnect');
      setGoogleStatus({ connected: false, email: null, account_id: null, location_id: null });
      setReviews([]);
      toast({ title: 'Disconnected', description: 'Google Business Profile has been unlinked.' });
    } catch (err: any) {
      toast({ title: 'Failed to disconnect', description: err?.message, variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  // ── AI Reply ─────────────────────────────────────────────────────────────
  const handleGenerateReply = async (review: Review): Promise<string> => {
    const rating = STAR_MAP[review.starRating];
    const data = await apiClient.post<{ reply: string }>(
      `/integration/google/reviews/${review.reviewId}/ai-reply`,
      {
        reviewer_name: review.reviewer.displayName,
        review_text: review.comment || '',
        star_rating: rating,
      }
    );
    toast({ title: '✨ AI reply generated!', description: 'Review, edit, and post below.' });
    return data.reply;
  };

  // ── Post Reply ───────────────────────────────────────────────────────────
  const handlePostReply = async (review: Review, replyText: string) => {
    // Note: 'posting' state is managed per ReviewCard to allow parallel actions,
    // but the API call itself is executed here.
    await apiClient.post(`/integration/google/reviews/${review.reviewId}/reply`, {
      comment: replyText,
    });
    setReviews(prev =>
      prev.map(r =>
        r.reviewId === review.reviewId
          ? { ...r, reviewReply: { comment: replyText, updateTime: new Date().toISOString() } }
          : r
      )
    );
    toast({ title: '🎉 Reply posted!', description: 'Your reply is now live on Google.' });
  };

  // ── Filter + Search ──────────────────────────────────────────────────────
  const filtered = reviews.filter(r => {
    const rating = STAR_MAP[r.starRating];
    const searchMatch =
      !searchQuery ||
      r.reviewer.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.comment || '').toLowerCase().includes(searchQuery.toLowerCase());
    const filterMatch =
      activeFilter === 'all' ? true :
      activeFilter === 'unanswered' ? !r.reviewReply :
      activeFilter === 'answered' ? !!r.reviewReply :
      activeFilter === `${rating}★`;
    return searchMatch && filterMatch;
  });

  // ── Loading state (checking status) ──────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        {[...Array(2)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!googleStatus?.connected) {
    return <ConnectBanner onConnect={handleConnect} connecting={connecting} />;
  }

  // ── Connected view ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-0">
      <ConnectedHeader
        status={googleStatus}
        onDisconnect={handleDisconnect}
        disconnecting={disconnecting}
        onRefresh={() => fetchReviews(true)}
        refreshing={refreshing}
        reviewCount={reviews.length}
      />

      {/* Stats */}
      {!reviewsLoading && reviews.length > 0 && <StatsBar reviews={reviews} />}

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name or review text..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-9"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {FILTER_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeFilter === f
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
              )}
            >
              {f === 'all' ? 'All' : f === 'unanswered' ? 'Unanswered' : f === 'answered' ? 'Answered' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Skeletons while loading reviews */}
      {reviewsLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Reviews */}
      {!reviewsLoading && (
        filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No reviews found</h3>
            <p className="text-sm text-slate-400">
              {reviews.length === 0
                ? 'No Google reviews found for your business yet.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(review => (
              <ReviewCard
                key={review.reviewId}
                review={review}
                onGenerateReply={handleGenerateReply}
                onPostReply={handlePostReply}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
