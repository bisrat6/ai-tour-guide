import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Shared visual tokens for Stitch-exported pages.
class StitchTheme {
  StitchTheme._();

  // Brand + neutral palette seen across Stitch export pages.
  static const Color parchment = Color(0xFFF0E6D2);
  static const Color parchmentLight = Color(0xFFFBFBF9);
  static const Color darkText = Color(0xFF12100E);
  static const Color slate = Color(0xFF4A443C);
  static const Color adwaGold = Color(0xFFC08A2E);
  static const Color charcoal = Color(0xFF383838);
  static const Color muted = Color(0xFFA69E93);
  static const Color ember = Color(0xFF8C3B3B);
  static const Color panel = Color(0xFF24211D);

  static TextStyle headline({
    double size = 28,
    FontWeight weight = FontWeight.w600,
    Color color = darkText,
    double? letterSpacing,
    double? height,
  }) {
    return GoogleFonts.bodoniModa(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  static TextStyle body({
    double size = 16,
    FontWeight weight = FontWeight.w400,
    Color color = darkText,
    double? letterSpacing,
    double? height,
  }) {
    return GoogleFonts.manrope(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  static TextStyle overline({
    double size = 12,
    FontWeight weight = FontWeight.w600,
    Color color = muted,
    double letterSpacing = 2.0,
  }) {
    return GoogleFonts.manrope(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
    );
  }
}

/// Reusable docked nav used by Stitch pages.
class StitchBottomNav extends StatelessWidget {
  const StitchBottomNav({
    super.key,
    required this.activeIndex,
    this.lightMode = true,
    this.onTap,
  });

  final int activeIndex;
  final bool lightMode;
  final ValueChanged<int>? onTap;

  @override
  Widget build(BuildContext context) {
    final Color barColor = lightMode ? StitchTheme.charcoal : StitchTheme.panel;
    final Color inactiveColor = lightMode ? Colors.white70 : StitchTheme.muted;
    final List<IconData> icons = <IconData>[
      Icons.explore_outlined,
      Icons.shopping_bag_outlined,
      Icons.location_on_outlined,
      Icons.monetization_on_outlined,
    ];

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: barColor.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(32),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List<Widget>.generate(icons.length, (int index) {
              final bool isActive = index == activeIndex;
              return Material(
                color: Colors.transparent,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: onTap == null ? null : () => onTap!(index),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isActive ? StitchTheme.adwaGold : Colors.transparent,
                    ),
                    padding: const EdgeInsets.all(10),
                    child: Icon(
                      icons[index],
                      color: isActive ? Colors.white : inactiveColor,
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
