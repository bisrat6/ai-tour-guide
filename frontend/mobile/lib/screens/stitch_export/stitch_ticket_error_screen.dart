import 'package:flutter/material.dart';

import 'stitch_theme.dart';

class StitchTicketErrorScreen extends StatelessWidget {
  const StitchTicketErrorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2EBD9),
      body: Stack(
        children: <Widget>[
          Positioned.fill(
            child: Opacity(
              opacity: 0.03,
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.transparent,
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 120),
              child: Center(
                child: Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(maxWidth: 380),
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFAFAFA),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE5DFCE)),
                    boxShadow: const <BoxShadow>[
                      BoxShadow(
                        color: Color.fromRGBO(0, 0, 0, 0.08),
                        blurRadius: 20,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Container(
                        width: 84,
                        height: 84,
                        decoration: const BoxDecoration(
                          color: Color(0xFF93000A),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.cancel_outlined,
                          color: Colors.white,
                          size: 44,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Invalid Ticket',
                        style: StitchTheme.headline(
                          size: 34,
                          color: const Color(0xFF24211D),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        "We couldn't recognize this QR code. Please ensure you are scanning a valid entry ticket for today's exhibitions.",
                        textAlign: TextAlign.center,
                        style: StitchTheme.body(
                          size: 16,
                          color: const Color(0xFF4C4640),
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF5F2EA),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE5DFCE)),
                        ),
                        child: Column(
                          children: <Widget>[
                            Text(
                              'ERROR REFERENCE',
                              style: StitchTheme.overline(
                                size: 10,
                                color: const Color(0xFF4C4640),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'ERR-0X88A2E',
                              style: StitchTheme.body(
                                size: 14,
                                color: const Color(0xFF24211D),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () => Navigator.pop(context),
                          style: FilledButton.styleFrom(
                            backgroundColor: StitchTheme.adwaGold,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                          icon: const Icon(Icons.refresh),
                          label: Text(
                            'TRY AGAIN',
                            style: StitchTheme.overline(
                              size: 12,
                              color: Colors.white,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Support team will assist you shortly.'),
                              ),
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFF4C4640), width: 1.8),
                            foregroundColor: const Color(0xFF4C4640),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                          icon: const Icon(Icons.support_agent),
                          label: Text(
                            'CONTACT SUPPORT',
                            style: StitchTheme.overline(
                              size: 12,
                              color: const Color(0xFF4C4640),
                              letterSpacing: 1.5,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
