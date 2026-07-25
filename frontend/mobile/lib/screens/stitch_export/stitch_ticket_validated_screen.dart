import 'package:flutter/material.dart';

import 'stitch_routes.dart';
import 'stitch_theme.dart';

class StitchTicketValidatedScreen extends StatelessWidget {
  const StitchTicketValidatedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bool fromShell =
        ModalRoute.of(context)?.settings.arguments == true;

    return Scaffold(
      backgroundColor: StitchTheme.parchment,
      body: Stack(
        children: <Widget>[
          Positioned(
            top: -40,
            right: -20,
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: 140,
            left: -60,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  const Spacer(),
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: <BoxShadow>[
                        BoxShadow(
                          color: StitchTheme.adwaGold.withValues(alpha: 0.25),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.check_circle,
                      color: StitchTheme.adwaGold,
                      size: 52,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Entry Granted',
                    style: StitchTheme.headline(
                      size: 34,
                      weight: FontWeight.w600,
                      color: StitchTheme.slate,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Welcome to the exhibition. Your journey begins now.',
                    textAlign: TextAlign.center,
                    style: StitchTheme.body(
                      size: 16,
                      color: StitchTheme.slate.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                    ),
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: <Widget>[
                        _line('Ticket ID', '#HM-9824-AX'),
                        const SizedBox(height: 16),
                        _line('Access', 'All-Access Pass'),
                        const SizedBox(height: 16),
                        _line('Date', 'Oct 24, 2024'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () {
                        if (fromShell) {
                          Navigator.pop(context);
                        } else {
                          Navigator.pushReplacementNamed(context, StitchRoutes.home);
                        }
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: StitchTheme.adwaGold,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      icon: const Icon(Icons.arrow_forward),
                      label: Text(
                        'Proceed to Hub',
                        style: StitchTheme.overline(
                          size: 13,
                          color: Colors.white,
                          letterSpacing: 1.6,
                        ),
                      ),
                    ),
                  ),
                  const Spacer(flex: 2),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _line(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(
          label.toUpperCase(),
          style: StitchTheme.overline(
            size: 11,
            color: StitchTheme.slate.withValues(alpha: 0.7),
          ),
        ),
        Text(
          value,
          style: StitchTheme.body(
            size: 16,
            weight: FontWeight.w600,
            color: StitchTheme.slate,
          ),
        ),
      ],
    );
  }
}
