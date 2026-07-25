import 'package:flutter/material.dart';

import 'stitch_donate_screen.dart';
import 'stitch_museum_hub_screen.dart';
import 'stitch_shop_screen.dart';
import 'stitch_theme.dart';
import 'stitch_ticket_validation_screen.dart';

/// Main post-entry shell: Explore, Shop, Scan, Donate.
class StitchAppShell extends StatefulWidget {
  const StitchAppShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<StitchAppShell> createState() => _StitchAppShellState();
}

class _StitchAppShellState extends State<StitchAppShell> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: const <Widget>[
          StitchMuseumHubScreen(showBottomNav: false),
          StitchShopScreen(showBottomNav: false),
          StitchTicketValidationScreen(showBottomNav: false),
          StitchDonateScreen(showBottomNav: false),
        ],
      ),
      bottomNavigationBar: StitchBottomNav(
        activeIndex: _currentIndex,
        onTap: (int index) => setState(() => _currentIndex = index),
      ),
    );
  }
}
