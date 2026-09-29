import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/design_tokens.dart';
import '../../auth/domain/auth_models.dart';
import '../../auth/presentation/pending_approval_screen.dart';
import '../../auth/presentation/phone_login_screen.dart';
import '../../auth/providers/auth_provider.dart';
import '../../earnings/presentation/rider_earnings_screen.dart';
import '../../trips/presentation/active_trip_screen.dart';
import '../../trips/presentation/widgets/incoming_trip_modal.dart';
import '../../trips/providers/trip_provider.dart';
import '../providers/duty_provider.dart';
import 'widgets/active_trip_banner.dart';
import 'widgets/cash_limit_alert_banner.dart';
import 'widgets/dispatch_radar_card.dart';
import 'widgets/duty_switch_card.dart';
import 'widgets/gps_telemetry_card.dart';
import 'widgets/performance_metrics_card.dart';
import 'widgets/rider_top_bar.dart';

class RiderDashboardScreen extends ConsumerWidget {
  const RiderDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(riderAuthProvider);
    final dutyState = ref.watch(riderDutyProvider);
    final tripState = ref.watch(riderTripProvider);
    final profile = authState.profile;

    ref.listen(riderTripProvider, (previous, next) {
      if (next.hasIncomingAlert && previous?.incomingTrip?.id != next.incomingTrip?.id) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => IncomingTripModal(trip: next.incomingTrip!),
        );
      }
    });

    if (authState.isPendingApproval || profile?.status == AccountStatus.pendingApproval) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const PendingApprovalScreen()),
        );
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final isOnline = dutyState.isOnline;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await ref.read(riderAuthProvider.notifier).fetchProfile();
          },
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 14),
            children: [
              RiderTopBar(
                profile: profile,
                onOpenEarnings: () => _navigateToEarnings(context),
                onLogout: () => _handleLogout(context, ref),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (dutyState.isCashLimitReached) ...[
                CashLimitAlertBanner(
                  dutyState: dutyState,
                  onDeposit: () => _navigateToEarnings(context),
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              DutySwitchCard(
                dutyState: dutyState,
                isOnline: isOnline,
                onToggleDuty: () => _handleToggleDuty(context, ref, isOnline),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (tripState.hasActiveTrip) ...[
                ActiveTripBanner(
                  trip: tripState.activeTrip!,
                  onResumeTrip: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ActiveTripScreen()),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              GpsTelemetryCard(dutyState: dutyState),
              const SizedBox(height: AppSpacing.lg),
              PerformanceMetricsCard(
                dutyState: dutyState,
                onOpenEarnings: () => _navigateToEarnings(context),
              ),
              const SizedBox(height: AppSpacing.lg),
              DispatchRadarCard(
                isOnline: isOnline,
                hasActiveTrip: tripState.hasActiveTrip,
                onSimulateBroadcast: () {
                  ref.read(riderTripProvider.notifier).simulateIncomingBroadcast();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateToEarnings(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const RiderEarningsScreen()),
    );
  }

  Future<void> _handleLogout(BuildContext context, WidgetRef ref) async {
    // Stop GPS beaconing and the foreground location service before wiping
    // credentials — telemetry must never outlive the session.
    await ref.read(riderDutyProvider.notifier).teardownForLogout();
    await ref.read(riderAuthProvider.notifier).logout();
    if (context.mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const PhoneLoginScreen()),
        (route) => false,
      );
    }
  }

  Future<void> _handleToggleDuty(BuildContext context, WidgetRef ref, bool isOnline) async {
    final hasActiveTrip = ref.read(riderTripProvider).hasActiveTrip;
    if (isOnline && hasActiveTrip) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot go offline while you have an active in-flight delivery. Please complete or release the order first.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final success = await ref.read(riderDutyProvider.notifier).toggleDuty();
    if (!success && context.mounted) {
      final error = ref.read(riderDutyProvider).error;
      if (error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error), backgroundColor: AppColors.error),
        );
      }
    }
  }
}
