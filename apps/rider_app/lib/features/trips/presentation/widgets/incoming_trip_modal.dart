import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/design_tokens.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../../dashboard/providers/duty_provider.dart';
import '../../domain/trip_models.dart';
import '../../providers/trip_provider.dart';
import '../active_trip_screen.dart';

class IncomingTripModal extends ConsumerWidget {
  final TripOrder trip;

  const IncomingTripModal({
    super.key,
    required this.trip,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripState = ref.watch(riderTripProvider);
    final dutyState = ref.watch(riderDutyProvider);
    final remainingSecs = tripState.countdownSeconds;
    final progress = (remainingSecs / 45.0).clamp(0.0, 1.0);
    final isBlockedByCashLimit = trip.isCod && dutyState.isCashLimitReached;

    ref.listen<RiderTripState>(riderTripProvider, (previous, next) {
      if (next.incomingTrip == null || next.countdownSeconds <= 0) {
        if (context.mounted && Navigator.of(context).canPop()) {
          Navigator.of(context).pop();
        }
      }
    });

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: AppColors.card,
      insetPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.xl),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.dutyOnlineBackground,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.dutyOnline),
                    ),
                    child: const Icon(
                      Icons.notifications_active_rounded,
                      color: AppColors.dutyOnline,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'NEW TRIP BROADCAST',
                          style: AppTypography.badgeText.copyWith(
                            fontSize: 13,
                            color: AppColors.dutyOnline,
                            letterSpacing: 0.8,
                          ),
                        ),
                        Text(
                          'Expires in ${remainingSecs}s',
                          style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 6),
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: AppRadius.roundedMd,
                    ),
                    child: Column(
                      children: [
                        Text(
                          'EARN',
                          style: AppTypography.badgeText.copyWith(fontSize: 9, color: AppColors.white70),
                        ),
                        Text(
                          formatCurrency(trip.payout),
                          style: AppTypography.h3.copyWith(fontWeight: FontWeight.w900, color: AppColors.white),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 6,
                  backgroundColor: AppColors.background,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    remainingSecs <= 10 ? AppColors.error : AppColors.dutyOnline,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: AppRadius.roundedLg,
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                trip.store.name,
                                style: AppTypography.bodyBold,
                              ),
                              Text(
                                '${trip.distanceKm} km away • ${trip.store.address}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.caption.copyWith(fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Padding(
                      padding: EdgeInsets.only(left: 10),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: SizedBox(
                          height: 16,
                          child: VerticalDivider(color: AppColors.borderStrong, thickness: 2),
                        ),
                      ),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.place_rounded, color: AppColors.dutyOnline, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                trip.customer.name,
                                style: AppTypography.bodyBold,
                              ),
                              Text(
                                trip.customer.address,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.caption.copyWith(fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                decoration: BoxDecoration(
                  color: trip.isCod ? AppColors.warningBackground : AppColors.dutyOnlineBackground,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: trip.isCod ? AppColors.warning.withValues(alpha: 0.4) : AppColors.dutyOnline.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Icon(
                            trip.isCod ? Icons.payments_rounded : Icons.credit_card_rounded,
                            size: 16,
                            color: trip.isCod ? AppColors.warning : AppColors.dutyOnline,
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              trip.isCod ? 'Cash on Delivery: ৳${trip.totalAmount.toStringAsFixed(0)}' : 'Paid Online (Prepaid)',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.badgeText.copyWith(
                                fontSize: 12,
                                color: trip.isCod ? AppColors.warning : AppColors.dutyOnline,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      '${trip.itemsCount} items',
                      style: AppTypography.caption.copyWith(fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (isBlockedByCashLimit) ...[
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.errorBackground,
                    borderRadius: AppRadius.roundedMd,
                    border: Border.all(color: AppColors.error.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'COD Safety Limit Reached (${formatCurrency(dutyState.codCashInHand)} / ${formatCurrency(dutyState.cashSafetyLimit)}). Deposit cash at the hub before taking new COD orders.',
                          style: AppTypography.caption.copyWith(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.error,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              if (tripState.error != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.errorBackground,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.error),
                  ),
                  child: Text(
                    tripState.error!,
                    style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600, color: AppColors.error),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: (tripState.isClaiming || isBlockedByCashLimit || remainingSecs <= 0)
                      ? null
                      : () async {
                          final success = await ref.read(riderTripProvider.notifier).claimTrip(trip);
                          if (context.mounted && success) {
                            Navigator.of(context).pop();
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const ActiveTripScreen()),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isBlockedByCashLimit ? AppColors.borderStrong : AppColors.dutyOnline,
                    foregroundColor: AppColors.white,
                    disabledBackgroundColor: AppColors.borderStrong.withValues(alpha: 0.5),
                    disabledForegroundColor: AppColors.white70,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: tripState.isClaiming
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2.5),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(isBlockedByCashLimit ? Icons.lock_rounded : Icons.check_circle_rounded, size: 22),
                            const SizedBox(width: AppSpacing.sm),
                            Flexible(
                              child: Text(
                                isBlockedByCashLimit ? 'COD LIMIT REACHED' : 'ACCEPT ORDER',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.buttonText.copyWith(fontSize: 17, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                              ),
                            ),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 10),
              Center(
                child: TextButton(
                  onPressed: () {
                    ref.read(riderTripProvider.notifier).dismissIncomingAlert();
                    Navigator.of(context).pop();
                  },
                  child: Text(
                    'Decline / Pass',
                    style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
