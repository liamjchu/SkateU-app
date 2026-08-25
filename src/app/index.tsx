import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import HomeRailCard, { HomeFeedRail } from '../components/home-rail-card';
import HomeSchoolStories from '../components/home-school-stories';
import HomeSpotPost from '../components/home-spot-post';
import LoginRequiredModal from '../components/LoginRequiredModal';
import SpotFullscreenViewer from '../components/spot-fullscreen-viewer';
import NoticeBanner from '../components/NoticeBanner';
import PopularSchoolCard, {
    SchoolSpotCount,
} from '../components/PopularSchoolCard';
import SchoolTypePills, {
    getSchoolTypesParam,
} from '../components/SchoolTypePills';
import { StickerStripe } from '../components/sticker';
import IMAGES from '../constants/images';
import { colors } from '../constants/colors';
import { captureAnalyticsEvent } from '../lib/analytics';
import { getApiUrl } from '../lib/api';
import { triggerHaptic } from '../lib/haptics';
import { HOME_RAIL_PAGE_SIZE } from '../lib/homeFeed';
import {
    getHomeLogoTapAction,
    getHomeLogoTapHint,
    isHomeFeedScrolled,
} from '../lib/homeLogoTap';
import { MIN_SEARCH_LENGTH, schoolMatchesQuery } from '../lib/schoolSearch';
import { toUserFacingError } from '../lib/userFacingError';
import { guardedNavigate } from '../lib/navigationGuard';
import {
    formatGuestBrowseMessage,
    GUEST_BROWSE_TITLE,
} from '../lib/guestBrowseCopy';
import { useAuthStore } from '../store/authStore';
import { useCommentsStore } from '../store/commentsStore';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import { useSpotsStore } from '../store/spotsStore';
import type { School, SchoolTypeFilter } from '../types/school';
import type { Spot } from '../types/spot';

type SchoolsSearchResponse = {
  schools: School[];
};

type RecentSpotsResponse = {
  spots: Spot[];
};

function recentSpotsAuthHeaders(accessToken?: string): HeadersInit | undefined {
  return accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;
}

const PROFILE_BUTTON_SIZE = 44;
const HEADER_LOGO_HEIGHT = (PROFILE_BUTTON_SIZE * 2) / 3;
const HEADER_LOGO_WIDTH = (195 / 36) * HEADER_LOGO_HEIGHT;

function getSchoolSearchCopy(filter: SchoolTypeFilter): {
  placeholder: string;
  accessibilityLabel: string;
} {
  switch (filter) {
    case 'saved':
      return {
        placeholder: 'Search saved schools...',
        accessibilityLabel: 'Search saved schools',
      };
    case 'k12':
      return {
        placeholder: 'Search K-12 schools...',
        accessibilityLabel: 'Search K-12 schools',
      };
    case 'college':
      return {
        placeholder: 'Search colleges...',
        accessibilityLabel: 'Search colleges',
      };
    default:
      return {
        placeholder: 'Search all schools...',
        accessibilityLabel: 'Search all schools',
      };
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { schools, upsertSchool } = useSchools();
  const session = useAuthStore((state) => state.session);
  const authInitializing = useAuthStore((state) => state.initializing);
  const toggleSpotLike = useSpotsStore((state) => state.toggleSpotLike);
  const commentCounts = useCommentsStore((state) => state.commentCounts);
  const {
    favoriteSchoolIds,
    favoriteSchools: storedFavoriteSchools,
    hasHydrated: hasHydratedFavorites,
    toggleFavoriteSchool,
    upsertFavoriteSchool,
  } = useFavorites();

  const searchInputRef = useRef<TextInput>(null);
  const feedScrollRef = useRef<ScrollView>(null);
  const feedScrollOffsetRef = useRef(0);
  const [isFeedScrolled, setIsFeedScrolled] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SchoolTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRetryNonce, setSearchRetryNonce] = useState(0);
  const [popularSchools, setPopularSchools] = useState<School[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState('');
  const [popularRetryNonce, setPopularRetryNonce] = useState(0);
  const [isLoadingMorePopular, setIsLoadingMorePopular] = useState(false);
  const [popularHasMore, setPopularHasMore] = useState(true);
  const [recentSpots, setRecentSpots] = useState<Spot[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState('');
  const [recentRetryNonce, setRecentRetryNonce] = useState(0);
  const [isLoadingMoreRecent, setIsLoadingMoreRecent] = useState(false);
  const [recentHasMore, setRecentHasMore] = useState(true);
  const [favoriteRefreshError, setFavoriteRefreshError] = useState('');
  const [favoriteRefreshNonce, setFavoriteRefreshNonce] = useState(0);
  const [isHydratingFavoriteSchools, setIsHydratingFavoriteSchools] =
    useState(true);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [fullscreenSpotId, setFullscreenSpotId] = useState<string | null>(
    null
  );
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState(0);
  const [commentsCoveringViewer, setCommentsCoveringViewer] = useState(false);
  const [likingSpotId, setLikingSpotId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wasNearBottomRef = useRef(false);
  const popularFilterRef = useRef(activeFilter);
  const recentFilterRef = useRef(activeFilter);

  const popularAbortRef = useRef<AbortController | null>(null);
  const recentAbortRef = useRef<AbortController | null>(null);
  const popularLockRef = useRef(false);
  const recentLockRef = useRef(false);
  const popularHasMoreRef = useRef(true);
  const recentHasMoreRef = useRef(true);
  const isLoadingPopularRef = useRef(true);
  const isLoadingRecentRef = useRef(true);
  const popularSchoolsRef = useRef<School[]>([]);
  const recentSpotsRef = useRef<Spot[]>([]);

  popularHasMoreRef.current = popularHasMore;
  recentHasMoreRef.current = recentHasMore;
  isLoadingPopularRef.current = isLoadingPopular || isLoadingMorePopular;
  isLoadingRecentRef.current = isLoadingRecent || isLoadingMoreRecent;
  popularSchoolsRef.current = popularSchools;
  recentSpotsRef.current = recentSpots;

  const isSearchMode = isSearchFocused || searchQuery.trim().length > 0;

  const exitSearchMode = useCallback(() => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setIsSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
  }, []);

  const favoriteSchools = favoriteSchoolIds
    .map((schoolId) => {
      const school =
        schools.find((school: School) => school.id === schoolId) ??
        storedFavoriteSchools.find((school) => school.id === schoolId);

      return school;
    })
    .filter((school): school is School => !!school);

  const displayedSearchResults = searchResults.map((searchResult) => {
    const school =
      schools.find((school: School) => school.id === searchResult.id) ??
      searchResult;

    return school;
  });

  const savedSearchResults = favoriteSchools.filter((school) =>
    schoolMatchesQuery(school, searchQuery)
  );

  const sortedSearchResults =
    activeFilter === 'saved'
      ? savedSearchResults
      : [
          ...displayedSearchResults.filter((school: School) =>
            favoriteSchoolIds.includes(school.id)
          ),
          ...displayedSearchResults.filter(
            (school: School) => !favoriteSchoolIds.includes(school.id)
          ),
        ];

  useEffect(() => {
    if (!hasHydratedFavorites) {
      setIsHydratingFavoriteSchools(true);
      return;
    }

    const missingFavoriteSchoolIds = favoriteSchoolIds.filter(
      (schoolId) => !schools.some((school) => school.id === schoolId)
    );

    if (missingFavoriteSchoolIds.length === 0) {
      setIsHydratingFavoriteSchools(false);
      return;
    }

    let cancelled = false;
    setIsHydratingFavoriteSchools(true);
    const controller = new AbortController();

    const fetchMissingFavoriteSchools = async () => {
      try {
        const response = await fetch(
          getApiUrl(`/api/schools?ids=${encodeURIComponent(missingFavoriteSchoolIds.join(','))}`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ?? `Saved schools lookup failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsSearchResponse;
        data.schools.forEach(upsertFavoriteSchool);
        if (!cancelled) {
          setFavoriteRefreshError('');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        if (!cancelled) {
          setFavoriteRefreshError(
            toUserFacingError(error, 'Couldn’t load saved schools right now.')
          );
        }
      } finally {
        if (!cancelled) {
          setIsHydratingFavoriteSchools(false);
        }
      }
    };

    fetchMissingFavoriteSchools();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    favoriteRefreshNonce,
    favoriteSchoolIds,
    hasHydratedFavorites,
    schools,
    upsertFavoriteSchool,
  ]);

  // Re-pull saved schools' spot counts from the backend whenever the home
  // screen regains focus (e.g. after adding a spot on the map), so the counter
  // reflects the current schools.numspots column.
  useFocusEffect(
    useCallback(() => {
      if (!hasHydratedFavorites || favoriteSchoolIds.length === 0) {
        return;
      }

      let cancelled = false;
      const controller = new AbortController();
      if (favoriteRefreshNonce > 0 && !cancelled) {
        setFavoriteRefreshError('');
      }

      const refreshFavoriteSchools = async () => {
        try {
          const response = await fetch(
            getApiUrl(`/api/schools?ids=${encodeURIComponent(favoriteSchoolIds.join(','))}`),
            { signal: controller.signal }
          );

          if (!response.ok) {
            throw new Error('Couldn’t refresh saved schools right now.');
          }

          const data = (await response.json()) as SchoolsSearchResponse;
          data.schools.forEach((school) => {
            upsertSchool(school);
            upsertFavoriteSchool(school);
          });
          if (!cancelled) {
            setFavoriteRefreshError('');
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }

          if (!cancelled) {
            setFavoriteRefreshError(
              toUserFacingError(error, 'Couldn’t refresh saved schools right now.')
            );
          }
        }
      };

      refreshFavoriteSchools();

      return () => {
        cancelled = true;
        controller.abort();
      };
    }, [
      favoriteRefreshNonce,
      favoriteSchoolIds,
      hasHydratedFavorites,
      upsertFavoriteSchool,
      upsertSchool,
    ])
  );

  useFocusEffect(
    useCallback(() => {
      setCommentsCoveringViewer(false);
    }, [])
  );

  // Load the most-spotted schools for the popular feed. Re-runs when the
  // type filter changes so the pills narrow down the feed too. Pages in as
  // the rail is scrolled so there is no total cap.
  useEffect(() => {
    popularAbortRef.current?.abort();

    if (activeFilter === 'saved') {
      setIsLoadingPopular(false);
      setIsLoadingMorePopular(false);
      setPopularHasMore(false);
      popularLockRef.current = false;
      return;
    }

    const controller = new AbortController();
    popularAbortRef.current = controller;
    popularLockRef.current = false;
    const filterChanged = popularFilterRef.current !== activeFilter;
    popularFilterRef.current = activeFilter;
    if (filterChanged || popularSchoolsRef.current.length === 0) {
      setPopularSchools([]);
    }
    setPopularHasMore(true);
    setIsLoadingPopular(true);
    setIsLoadingMorePopular(false);

    const loadPopularSchools = async () => {
      try {
        const typeParam = getSchoolTypesParam(activeFilter);
        const typeQuery = typeParam
          ? `&type=${encodeURIComponent(typeParam)}`
          : '';
        const response = await fetch(
          getApiUrl(`/api/schools?popular=1${typeQuery}`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ?? `Popular schools failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsSearchResponse;
        const page = data.schools ?? [];
        page.forEach(upsertSchool);

        if (!controller.signal.aborted) {
          setPopularSchools(page);
          setPopularHasMore(page.length === HOME_RAIL_PAGE_SIZE);
          setPopularError('');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        if (!controller.signal.aborted) {
          setPopularError(
            toUserFacingError(error, 'Couldn’t load popular schools right now.')
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPopular(false);
        }
      }
    };

    loadPopularSchools();

    return () => controller.abort();
  }, [activeFilter, popularRetryNonce, upsertSchool]);

  useEffect(() => {
    recentAbortRef.current?.abort();

    if (activeFilter === 'saved') {
      setIsLoadingRecent(false);
      setIsLoadingMoreRecent(false);
      setRecentHasMore(false);
      recentLockRef.current = false;
      return;
    }

    const controller = new AbortController();
    recentAbortRef.current = controller;
    recentLockRef.current = false;
    const filterChanged = recentFilterRef.current !== activeFilter;
    recentFilterRef.current = activeFilter;
    if (filterChanged || recentSpotsRef.current.length === 0) {
      setRecentSpots([]);
    }
    setRecentHasMore(true);
    setIsLoadingRecent(true);
    setIsLoadingMoreRecent(false);

    const loadRecentSpots = async () => {
      try {
        const typeParam = getSchoolTypesParam(activeFilter);
        const typeQuery = typeParam
          ? `&type=${encodeURIComponent(typeParam)}`
          : '';
        const response = await fetch(
          getApiUrl(`/api/spots?recent=1${typeQuery}`),
          {
            signal: controller.signal,
            headers: recentSpotsAuthHeaders(session?.access_token),
          }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ?? `Recent spots failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as RecentSpotsResponse;
        const page = data.spots ?? [];

        if (!controller.signal.aborted) {
          setRecentSpots(page);
          setRecentHasMore(page.length === HOME_RAIL_PAGE_SIZE);
          setRecentError('');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        if (!controller.signal.aborted) {
          setRecentError(
            toUserFacingError(error, 'Couldn’t load recent spots right now.')
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingRecent(false);
        }
      }
    };

    loadRecentSpots();

    return () => controller.abort();
  }, [activeFilter, recentRetryNonce, session?.access_token]);

  const loadMorePopularSchools = useCallback(async () => {
    if (
      popularLockRef.current ||
      isLoadingPopularRef.current ||
      !popularHasMoreRef.current
    ) {
      return;
    }

    const controller = popularAbortRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }

    popularLockRef.current = true;
    setIsLoadingMorePopular(true);

    try {
      const typeParam = getSchoolTypesParam(activeFilter);
      const typeQuery = typeParam
        ? `&type=${encodeURIComponent(typeParam)}`
        : '';
      const offset = popularSchoolsRef.current.length;
      const response = await fetch(
        getApiUrl(`/api/schools?popular=1${typeQuery}&offset=${offset}`),
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error('Couldn’t load more popular schools right now.');
      }

      const data = (await response.json()) as SchoolsSearchResponse;
      const page = data.schools ?? [];
      page.forEach(upsertSchool);

      if (!controller.signal.aborted) {
        setPopularSchools((current) => {
          const seen = new Set(current.map((school) => school.id));
          return [
            ...current,
            ...page.filter((school) => !seen.has(school.id)),
          ];
        });
        setPopularHasMore(page.length === HOME_RAIL_PAGE_SIZE);
        setPopularError('');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (!controller.signal.aborted) {
        setPopularError(
          toUserFacingError(
            error,
            'Couldn’t load more popular schools right now.'
          )
        );
      }
    } finally {
      popularLockRef.current = false;
      if (!controller.signal.aborted) {
        setIsLoadingMorePopular(false);
      }
    }
  }, [activeFilter, upsertSchool]);

  const loadMoreRecentSpots = useCallback(async () => {
    if (
      recentLockRef.current ||
      isLoadingRecentRef.current ||
      !recentHasMoreRef.current
    ) {
      return;
    }

    const controller = recentAbortRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }

    recentLockRef.current = true;
    setIsLoadingMoreRecent(true);

    try {
      const typeParam = getSchoolTypesParam(activeFilter);
      const typeQuery = typeParam
        ? `&type=${encodeURIComponent(typeParam)}`
        : '';
      const offset = recentSpotsRef.current.length;
      const response = await fetch(
        getApiUrl(`/api/spots?recent=1${typeQuery}&offset=${offset}`),
        {
          signal: controller.signal,
          headers: recentSpotsAuthHeaders(session?.access_token),
        }
      );

      if (!response.ok) {
        throw new Error('Couldn’t load more recent spots right now.');
      }

      const data = (await response.json()) as RecentSpotsResponse;
      const page = data.spots ?? [];

      if (!controller.signal.aborted) {
        setRecentSpots((current) => {
          const seen = new Set(current.map((spot) => spot.id));
          return [...current, ...page.filter((spot) => !seen.has(spot.id))];
        });
        setRecentHasMore(page.length === HOME_RAIL_PAGE_SIZE);
        setRecentError('');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (!controller.signal.aborted) {
        setRecentError(
          toUserFacingError(error, 'Couldn’t load more recent spots right now.')
        );
      }
    } finally {
      recentLockRef.current = false;
      if (!controller.signal.aborted) {
        setIsLoadingMoreRecent(false);
      }
    }
  }, [activeFilter, session?.access_token]);

  useEffect(() => {
    if (!isSearchMode) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        exitSearchMode();
        return true;
      }
    );

    return () => subscription.remove();
  }, [isSearchMode, exitSearchMode]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (activeFilter === 'saved' || trimmedQuery.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError('');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');

      try {
        const typeParam = getSchoolTypesParam(activeFilter);
        const typeQuery = typeParam
          ? `&type=${encodeURIComponent(typeParam)}`
          : '';
        const response = await fetch(
          getApiUrl(`/api/schools?search=${encodeURIComponent(trimmedQuery)}${typeQuery}`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ?? `School search failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsSearchResponse;

        data.schools.forEach((school) => {
          upsertSchool(school);
          upsertFavoriteSchool(school);
        });
        setSearchResults(data.schools);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setSearchError(toUserFacingError(error, 'Couldn’t search schools right now.'));
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [searchQuery, searchRetryNonce, activeFilter, upsertFavoriteSchool, upsertSchool]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    // Clearing keeps the user in search mode, ready to type a new query.
    searchInputRef.current?.focus();
  };

  const handleRetrySearch = () => {
    setSearchError('');
    setSearchRetryNonce((nonce) => nonce + 1);
  };

  const navigateToSchoolMap = (school: School) => {
    captureAnalyticsEvent('school_opened', { school_id: school.id });
    guardedNavigate(`map:${school.id}`, () => {
      router.push({
        pathname: '/map',
        params: {
          lat: school.lat.toString(),
          lng: school.lng.toString(),
          schoolName: school.name,
          schoolId: school.id,
          schoolCity: school.city,
          schoolState: school.state,
          schoolNumSpots: school.numSpots.toString(),
        },
      });
    });
  };

  const handleSchoolPress = (school: School) => {
    upsertSchool(school);
    Keyboard.dismiss();
    navigateToSchoolMap(school);
  };

  const handleRecentSpotPress = (spot: Spot) => {
    if (!spot.schoolId) {
      Alert.alert(
        'Campus map unavailable',
        'This spot is not tied to a campus, so there is no map to open.'
      );
      return;
    }

    Keyboard.dismiss();
    captureAnalyticsEvent('school_opened', { school_id: spot.schoolId });
    guardedNavigate(`map-spot:${spot.id}`, () => {
      router.push({
        pathname: '/map',
        params: {
          lat: spot.latitude.toString(),
          lng: spot.longitude.toString(),
          schoolId: spot.schoolId,
          schoolName: spot.schoolName || 'Campus map',
          schoolCity: spot.city,
          schoolState: spot.state,
          spotId: spot.id,
        },
      });
    });
  };

  const handleLikeSpot = async (spot: Spot) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setShowLoginRequired(true);
      return;
    }

    if (likingSpotId) {
      return;
    }

    setLikingSpotId(spot.id);
    try {
      const result = await toggleSpotLike(
        spot.id,
        spot.likedByUser === true,
        accessToken
      );
      triggerHaptic('light');
      setRecentSpots((current) =>
        current.map((item) =>
          item.id === spot.id
            ? {
                ...item,
                likedByUser: result.likedByUser,
                likeCount: result.likeCount,
              }
            : item
        )
      );
    } catch (error) {
      Alert.alert(
        'Couldn’t update that like',
        toUserFacingError(error, 'Please try again.')
      );
    } finally {
      setLikingSpotId(null);
    }
  };

  const handleOpenComments = (spot: Spot) => {
    if (fullscreenSpotId !== null) {
      setCommentsCoveringViewer(true);
    }
    guardedNavigate(`comments:${spot.id}`, () => {
      router.push({
        pathname: '/spot-comments',
        params: { spotId: spot.id, spotName: spot.name },
      });
    });
  };

  const handleOpenFullscreen = (spot: Spot, photoIndex = 0) => {
    Keyboard.dismiss();
    captureAnalyticsEvent('spot_opened', {
      spot_id: spot.id,
      ...(spot.schoolId ? { school_id: spot.schoolId } : {}),
    });
    setFullscreenPhotoIndex(photoIndex);
    setFullscreenSpotId(spot.id);
  };

  const handleViewMapFromFullscreen = (spot: Spot) => {
    setFullscreenSpotId(null);
    handleRecentSpotPress(spot);
  };

  const feedViewerSpots = useMemo(
    () =>
      recentSpots.map((spot) => ({
        ...spot,
        commentCount: commentCounts[spot.id] ?? spot.commentCount,
      })),
    [commentCounts, recentSpots]
  );

  const handleFavoritePress = (school: School) => {
    upsertSchool(school);
    toggleFavoriteSchool(school);
  };

  const handleProfilePress = () => {
    if (session) {
      guardedNavigate('profile', () => {
        router.push('/profile');
      });
      return;
    }

    guardedNavigate('login', () => {
      router.push('/login');
    });
  };

  const handleRefresh = () => {
    if (activeFilter === 'saved') {
      setFavoriteRefreshError('');
      setFavoriteRefreshNonce((nonce) => nonce + 1);
      return;
    }

    setIsRefreshing(true);
    setIsLoadingPopular(true);
    setIsLoadingRecent(true);
    setPopularRetryNonce((nonce) => nonce + 1);
    setRecentRetryNonce((nonce) => nonce + 1);
  };

  const homeLogoTapAction = getHomeLogoTapAction({
    isSearchMode,
    isScrolled: isFeedScrolled,
  });

  const handleHomeLogoPress = () => {
    const action = getHomeLogoTapAction({
      isSearchMode,
      isScrolled: isHomeFeedScrolled(feedScrollOffsetRef.current),
    });

    if (action === 'exit-search') {
      exitSearchMode();
      return;
    }

    if (action === 'scroll-to-top') {
      feedScrollRef.current?.scrollTo({ y: 0, animated: true });
      feedScrollOffsetRef.current = 0;
      setIsFeedScrolled(false);
      return;
    }

    if (isRefreshing) {
      return;
    }

    handleRefresh();
  };

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isLoadingPopular && !isLoadingRecent) {
      setIsRefreshing(false);
    }
  }, [isLoadingPopular, isLoadingRecent, isRefreshing]);

  const trimmedSearch = searchQuery.trim();
  const showRemoteSearchResults =
    activeFilter !== 'saved' && trimmedSearch.length >= MIN_SEARCH_LENGTH;
  const searchStatusText = isSearching
    ? 'Searching…'
    : `${sortedSearchResults.length} ${
        sortedSearchResults.length === 1 ? 'school' : 'schools'
      }`;
  const schoolSearchCopy = getSchoolSearchCopy(activeFilter);

  return (
    <View className="flex-1 bg-surface">
      <View className="bg-brand">
        <View
          className="px-6 pb-5"
          style={{
            paddingTop: insets.top + 24,
          }}
        >
        <View className="h-11 flex-row items-center justify-between">
          <FeedbackPressable
            haptic="light"
            disablePressScale
            onPress={handleHomeLogoPress}
            className="h-11 justify-center"
            accessibilityRole="button"
            accessibilityLabel="SkateU"
            accessibilityHint={getHomeLogoTapHint(homeLogoTapAction)}
          >
            <Image
              source={IMAGES.brandLockup}
              style={{
                width: HEADER_LOGO_WIDTH,
                height: HEADER_LOGO_HEIGHT,
              }}
              resizeMode="contain"
              accessible={false}
            />
          </FeedbackPressable>

          <FeedbackPressable
            haptic="light"
            onPress={handleProfilePress}
            className="ml-3 h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white"
            accessibilityLabel="Open profile"
            accessibilityRole="button"
          >
            <Feather name="user" size={20} color={colors.brand} />
          </FeedbackPressable>
        </View>

        <View className="mt-4 flex-row items-center">
          <View className="relative min-w-0 flex-1 justify-center">
            <View className="overflow-hidden rounded-2xl bg-field">
              <View className="relative justify-center">
                <View className="absolute left-5 z-10">
                  <Ionicons name="search" size={20} color={colors.ink} />
                </View>
                <TextInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder={schoolSearchCopy.placeholder}
                  placeholderTextColor={colors.muted}
                  accessibilityLabel={schoolSearchCopy.accessibilityLabel}
                  accessibilityHint={
                    activeFilter === 'saved'
                      ? 'Filters your saved schools by name, city, or state'
                      : 'Type a school, city, or 2-letter state'
                  }
                  numberOfLines={1}
                  multiline={false}
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  className="h-14 bg-field pl-14 pr-12 font-outfit-semibold text-base text-ink"
                />

                {searchQuery.length > 0 ? (
                  <View className="absolute right-3 z-10">
                    <FeedbackPressable
                      onPress={handleClearSearch}
                      className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft"
                      accessibilityRole="button"
                      accessibilityLabel="Clear school search"
                    >
                      <Feather name="x" size={16} color={colors.muted} />
                    </FeedbackPressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {isSearchMode ? (
            <FeedbackPressable
              onPress={exitSearchMode}
              className="ml-3 h-14 shrink-0 justify-center"
              accessibilityRole="button"
              accessibilityLabel="Cancel search"
            >
              <Text className="font-outfit-semibold text-base text-white">
                Cancel
              </Text>
            </FeedbackPressable>
          ) : null}
        </View>
        </View>
        <StickerStripe />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' && isSearchMode ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View className="w-full max-w-[760px] flex-1 self-center px-6">
          <View className="pt-3 pb-5">
            <SchoolTypePills
              selected={activeFilter}
              onSelect={setActiveFilter}
            />
          </View>

          {!session && !authInitializing ? (
            <NoticeBanner
              id="guest-browse-v2"
              collapsed={isSearchMode}
              icon="eye-outline"
              title={GUEST_BROWSE_TITLE}
              message={formatGuestBrowseMessage()}
              actionLabel="Sign in"
              onAction={() =>
                guardedNavigate('login', () => {
                  router.push('/login');
                })
              }
            />
          ) : null}

          <ScrollView
            ref={feedScrollRef}
            className="min-h-0 flex-1"
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={
                  activeFilter === 'saved' ? false : isRefreshing
                }
                onRefresh={handleRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
            scrollEventThrottle={16}
            onScroll={(event) => {
              const { contentOffset, layoutMeasurement, contentSize } =
                event.nativeEvent;
              feedScrollOffsetRef.current = contentOffset.y;
              const scrolled = isHomeFeedScrolled(contentOffset.y);
              if (scrolled !== isFeedScrolled) {
                setIsFeedScrolled(scrolled);
              }

              if (activeFilter === 'saved' || isSearchMode) {
                return;
              }

              const remaining =
                contentSize.height -
                (contentOffset.y + layoutMeasurement.height);
              const isNearBottom = remaining < 240;
              if (isNearBottom && !wasNearBottomRef.current) {
                void loadMoreRecentSpots();
              }
              wasNearBottomRef.current = isNearBottom;
            }}
          >
            {activeFilter === 'saved' ? (
              <View>
                <Text className="mb-4 font-outfit-bold text-base text-ink">
                  Saved
                </Text>

                {favoriteRefreshError ? (
                  <View className="mb-4 flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
                    <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
                      {favoriteRefreshError}
                    </Text>
                    <FeedbackPressable
                      onPress={() => {
                        setFavoriteRefreshError('');
                        setFavoriteRefreshNonce((nonce) => nonce + 1);
                      }}
                      className="rounded-xl bg-accent px-3 py-1.5"
                      accessibilityRole="button"
                      accessibilityLabel="Retry refreshing saved schools"
                    >
                      <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
                    </FeedbackPressable>
                  </View>
                ) : null}

                {isHydratingFavoriteSchools ? (
                  <View
                    className="items-center rounded-2xl bg-field px-6 py-8"
                    accessibilityLabel="Loading saved schools"
                    accessibilityLiveRegion="polite"
                  >
                    <Text className="text-lg text-ink font-outfit-bold">
                      Loading saved schools…
                    </Text>
                    <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                      Restoring your saved schools.
                    </Text>
                  </View>
                ) : favoriteSchools.length === 0 ? (
                  <View className="items-center rounded-2xl bg-field px-6 py-8">
                    <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                      <Ionicons name="bookmark-outline" size={26} color={colors.brand} />
                    </View>
                    <Text className="mt-3 text-lg text-ink font-outfit-bold">
                      No saved schools yet
                    </Text>
                    <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                      Tap the bookmark on a school to keep it here.
                    </Text>
                  </View>
                ) : savedSearchResults.length === 0 ? (
                  <View className="items-center rounded-2xl bg-field px-6 py-8">
                    <Text className="text-lg text-ink font-outfit-bold">
                      No matches
                    </Text>
                    <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                      Nothing in Saved matches that search.
                    </Text>
                  </View>
                ) : (
                  savedSearchResults.map((school: School) => (
                    <PopularSchoolCard
                      key={school.id}
                      school={school}
                      isSaved
                      onPress={handleSchoolPress}
                      onToggleSave={handleFavoritePress}
                    />
                  ))
                )}
              </View>
            ) : showRemoteSearchResults ? (
              <View>
                <Text
                  accessibilityLiveRegion="polite"
                  className="mb-4 font-outfit-bold text-base text-ink"
                >
                  {searchStatusText}
                </Text>

                {searchError ? (
                  <View className="mb-4 flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
                    <Text
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      className="flex-1 pr-2 font-outfit-medium text-sm text-errorText"
                    >
                      {searchError}
                    </Text>
                    <FeedbackPressable
                      onPress={handleRetrySearch}
                      className="rounded-xl bg-accent px-3 py-1.5"
                      accessibilityRole="button"
                      accessibilityLabel="Retry school search"
                    >
                      <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
                    </FeedbackPressable>
                  </View>
                ) : null}

                {isSearching && sortedSearchResults.length === 0 ? (
                  <View accessibilityLabel="Searching schools">
                    {[0, 1, 2].map((placeholder) => (
                      <View
                        key={placeholder}
                        className="mb-4 h-24 rounded-2xl bg-field"
                      />
                    ))}
                  </View>
                ) : sortedSearchResults.length > 0 ? (
                  sortedSearchResults.map((school: School) => (
                    <PopularSchoolCard
                      key={school.id}
                      school={school}
                      isSaved={favoriteSchoolIds.includes(school.id)}
                      onPress={handleSchoolPress}
                      onToggleSave={handleFavoritePress}
                    />
                  ))
                ) : searchError ? null : (
                  <View className="items-center rounded-2xl bg-field px-6 py-8">
                    <Text className="text-lg text-ink font-outfit-bold">
                      No schools found
                    </Text>
                    <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                      Try a school name, city, or state.
                    </Text>
                  </View>
                )}
              </View>
            ) : isSearchFocused && trimmedSearch.length > 0 ? (
              <View className="items-center rounded-2xl bg-field px-6 py-8">
                <Text className="text-lg text-ink font-outfit-bold">
                  Keep typing…
                </Text>
                <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                  Type a school, city, or 2-letter state.
                </Text>
              </View>
            ) : (
              <View className="gap-8">
                <HomeSchoolStories
                  schools={favoriteSchools}
                  onPress={handleSchoolPress}
                  onToggleSave={handleFavoritePress}
                />

                <HomeFeedRail
                  title="Popular schools"
                  subtitle="Tap a campus to open its map"
                  isLoading={isLoadingPopular && popularSchools.length === 0}
                  loadingAccessibilityLabel="Loading popular schools"
                  error={popularError}
                  onRetry={() => {
                    setPopularError('');
                    setPopularRetryNonce((nonce) => nonce + 1);
                  }}
                  retryAccessibilityLabel="Retry loading popular schools"
                  isEmpty={popularSchools.length === 0}
                  onEndReached={loadMorePopularSchools}
                  isLoadingMore={isLoadingMorePopular}
                  empty={
                    <View className="items-center rounded-2xl bg-field px-6 py-8">
                      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                        <Feather name="trending-up" size={26} color={colors.brand} />
                      </View>
                      <Text className="mt-3 text-lg text-ink font-outfit-bold">
                        No popular schools yet
                      </Text>
                      <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                        Schools with the most skate spots will show up here.
                      </Text>
                    </View>
                  }
                >
                  {popularSchools.map((school: School) => {
                    const isSaved = favoriteSchoolIds.includes(school.id);

                    return (
                      <HomeRailCard
                        key={school.id}
                        imageUrl={school.spotImageUrl}
                        title={school.name}
                        subtitle={`${school.city}, ${school.state}`}
                        meta={
                          <SchoolSpotCount
                            count={school.numSpots}
                            type={school.type}
                          />
                        }
                        onPress={() => handleSchoolPress(school)}
                        accessibilityLabel={`Open ${school.name} campus map`}
                        accessory={
                          <FeedbackPressable
                            haptic="selection"
                            onPress={() => handleFavoritePress(school)}
                            className={`h-9 w-9 items-center justify-center rounded-full ${
                              isSaved ? 'bg-accent' : 'bg-white'
                            }`}
                            accessibilityRole="button"
                            accessibilityLabel={`${isSaved ? 'Remove' : 'Add'} ${school.name} ${isSaved ? 'from' : 'to'} saved schools`}
                            accessibilityState={{ selected: isSaved }}
                          >
                            <Ionicons
                              name={isSaved ? 'bookmark' : 'bookmark-outline'}
                              size={16}
                              color={isSaved ? colors.brand : colors.ink}
                            />
                          </FeedbackPressable>
                        }
                      />
                    );
                  })}
                </HomeFeedRail>

                <View>
                  <View className="mb-4">
                    <Text className="font-outfit-bold text-base text-ink">
                      Latest spots
                    </Text>
                    <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
                      Like a spot here, or open it on the map
                    </Text>
                  </View>

                  {isLoadingRecent && recentSpots.length === 0 ? (
                    <View
                      accessibilityLabel="Loading latest spots"
                      className="gap-4"
                    >
                      {[0, 1].map((placeholder) => (
                        <View
                          key={placeholder}
                          className="h-80 rounded-2xl bg-field"
                        />
                      ))}
                    </View>
                  ) : recentError && recentSpots.length === 0 ? (
                    <View className="flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
                      <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
                        {recentError}
                      </Text>
                      <FeedbackPressable
                        onPress={() => {
                          setRecentError('');
                          setRecentRetryNonce((nonce) => nonce + 1);
                        }}
                        className="rounded-xl bg-accent px-3 py-1.5"
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading latest spots"
                      >
                        <Text className="font-outfit-bold text-sm text-brand">
                          Retry
                        </Text>
                      </FeedbackPressable>
                    </View>
                  ) : recentSpots.length === 0 ? (
                    <View className="items-center rounded-2xl bg-field px-6 py-8">
                      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                        <Feather name="map-pin" size={26} color={colors.brand} />
                      </View>
                      <Text className="mt-3 text-lg text-ink font-outfit-bold">
                        No spots yet
                      </Text>
                      <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                        When someone adds a spot, it’ll show up here to like or
                        open on the map.
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-4">
                      {recentSpots.map((spot) => (
                        <HomeSpotPost
                          key={spot.id}
                          spot={{
                            ...spot,
                            commentCount:
                              commentCounts[spot.id] ?? spot.commentCount,
                          }}
                          isLiking={likingSpotId === spot.id}
                          onLike={handleLikeSpot}
                          onViewMap={handleRecentSpotPress}
                          onOpenComments={handleOpenComments}
                          onOpenFullscreen={handleOpenFullscreen}
                        />
                      ))}
                      {recentError ? (
                        <View className="flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
                          <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
                            {recentError}
                          </Text>
                          <FeedbackPressable
                            onPress={() => {
                              setRecentError('');
                              setRecentRetryNonce((nonce) => nonce + 1);
                            }}
                            className="rounded-xl bg-accent px-3 py-1.5"
                            accessibilityRole="button"
                            accessibilityLabel="Retry loading latest spots"
                          >
                            <Text className="font-outfit-bold text-sm text-brand">
                              Retry
                            </Text>
                          </FeedbackPressable>
                        </View>
                      ) : isLoadingMoreRecent ? (
                        <View className="items-center py-4">
                          <ActivityIndicator color={colors.accent} />
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <SpotFullscreenViewer
        visible={fullscreenSpotId !== null && !commentsCoveringViewer}
        spots={feedViewerSpots}
        initialSpotId={fullscreenSpotId ?? ''}
        initialPhotoIndex={fullscreenPhotoIndex}
        variant="feed"
        onClose={() => setFullscreenSpotId(null)}
        onLike={handleLikeSpot}
        onOpenComments={handleOpenComments}
        onViewMap={handleViewMapFromFullscreen}
        onNearEnd={loadMoreRecentSpots}
        likingSpotId={likingSpotId}
      />
      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
      />
    </View>
  );
}
