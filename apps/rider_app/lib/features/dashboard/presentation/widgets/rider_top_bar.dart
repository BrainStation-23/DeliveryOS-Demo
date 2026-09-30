import 'package:flutter/material.dart';
import '../../../../core/constants/design_tokens.dart';
import '../../../auth/domain/auth_models.dart';

class RiderTopBar extends StatelessWidget {
  final RiderProfileData? profile;
  final VoidCallback onOpenEarnings;
  final VoidCallback onLogout;

  const RiderTopBar({
    super.key,
    required this.profile,
    required this.onOpenEarnings,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.roundedLg,
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.primaryLight.withValues(alpha: 0.15),
            child: const Icon(Icons.person_pin_rounded, color: AppColors.primary, size: 28),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        profile?.fullName ?? 'Rider Partner',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.h3.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                    const SizedBox(width: 6),
                    // Lifetime completed trips come from the rider profile API;
                    // courier ratings are not a live data model yet, so no
                    // fabricated score badge is rendered.
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.dutyOnlineBackground,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.route_rounded, size: 13, color: AppColors.dutyOnline),
                          const SizedBox(width: 2),
                          Text(
                            '${profile?.completedTripsCount ?? 0} trips',
                            style: AppTypography.badgeText.copyWith(color: AppColors.dutyOnline),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(
                      _getVehicleIcon(profile?.vehicleType),
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Flexible(
                      child: Text(
                        profile?.vehicleType.displayName ?? 'Motorcycle',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (profile?.phone != null && profile!.phone.isNotEmpty) ...[
                      Text(' • ', style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                      Flexible(
                        child: Text(
                          profile!.phone,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_rounded, color: AppColors.primary, size: 22),
            tooltip: 'Earnings & COD Wallet',
            onPressed: onOpenEarnings,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary, size: 20),
            tooltip: 'Log Out',
            onPressed: onLogout,
          ),
        ],
      ),
    );
  }

  IconData _getVehicleIcon(VehicleType? vehicle) {
    switch (vehicle) {
      case VehicleType.bicycle:
        return Icons.pedal_bike_rounded;
      case VehicleType.car:
        return Icons.directions_car_rounded;
      case VehicleType.motorcycle:
      default:
        return Icons.two_wheeler_rounded;
    }
  }
}
