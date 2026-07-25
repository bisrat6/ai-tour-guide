import 'package:flutter/material.dart';

import 'stitch_routes.dart';
import 'stitch_theme.dart';

class StitchTicketValidationScreen extends StatefulWidget {
  const StitchTicketValidationScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<StitchTicketValidationScreen> createState() =>
      _StitchTicketValidationScreenState();
}

class _StitchTicketValidationScreenState
    extends State<StitchTicketValidationScreen> {
  final TextEditingController _ticketController = TextEditingController();

  @override
  void dispose() {
    _ticketController.dispose();
    super.dispose();
  }

  void _submitTicket() {
    StitchRoutes.submitTicket(
      context,
      _ticketController.text,
      replaceOnSuccess: widget.showBottomNav,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0E6),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  const CircleAvatar(
                    radius: 20,
                    backgroundImage: NetworkImage(
                      'https://lh3.googleusercontent.com/aida-public/AB6AXuBVUk-pRV2ru25WMXxS8nBn0CbWQu0hcF5Ov5F_57NYa9wDZAnB29W8k8wPqtYk1uL_pAuTaBmzKJGNIHNH24zUAfaop4Mz5-pPzm1ZeIHNIl2sZnIcLoOhioF1xzS6-Ny1zvtElHO7CF82_wuhyOcXlCM_pP5mt_E-fUZA_dxku_BB0LoD8l5SehSl-UD2EnBK0_bIcxloed-CD5y7gvIhg3rlQum7M8KgMQy_wmPjOfON7BV2gtY5NLVc5cQK0N1rsXXfrgaFPIn3',
                    ),
                  ),
                  Text(
                    'THE GALLERY',
                    style: StitchTheme.headline(
                      size: 24,
                      weight: FontWeight.w500,
                      color: StitchTheme.darkText,
                      letterSpacing: 2,
                    ),
                  ),
                  IconButton(
                    onPressed: () {},
                    icon: const Icon(Icons.near_me_outlined),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              Center(
                child: Column(
                  children: <Widget>[
                    Text(
                      'Validate Access',
                      style: StitchTheme.headline(
                        size: 42,
                        color: StitchTheme.darkText,
                        height: 1.0,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Present your digital or physical ticket for gallery entry.',
                      textAlign: TextAlign.center,
                      style: StitchTheme.body(
                        size: 17,
                        color: StitchTheme.darkText.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFE5CE),
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(color: const Color(0xFFE2D5BC)),
                ),
                child: Column(
                  children: <Widget>[
                    Container(
                      height: 280,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F0F0),
                        borderRadius: BorderRadius.circular(24),
                        border: Border(
                          top: BorderSide(
                            color: StitchTheme.adwaGold,
                            width: 3,
                          ),
                        ),
                        boxShadow: const <BoxShadow>[
                          BoxShadow(
                            color: Color.fromRGBO(194, 146, 53, 0.4),
                            blurRadius: 24,
                            offset: Offset(0, -8),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          const Icon(Icons.qr_code_2, size: 72),
                          const SizedBox(height: 12),
                          Text(
                            'AWAITING SCAN',
                            style: StitchTheme.overline(
                              size: 12,
                              color: StitchTheme.darkText,
                              letterSpacing: 2.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    Row(
                      children: <Widget>[
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'OR ENTER MANUALLY',
                            style: StitchTheme.overline(
                              size: 11,
                              color: StitchTheme.darkText,
                            ),
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'TICKET CODE',
                        style: StitchTheme.overline(
                          size: 11,
                          color: StitchTheme.darkText,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _ticketController,
                      textCapitalization: TextCapitalization.characters,
                      onSubmitted: (_) => _submitTicket(),
                      decoration: InputDecoration(
                        hintText: 'e.g. GLRY-2024-XXXX',
                        prefixIcon: const Icon(Icons.confirmation_num_outlined),
                        filled: true,
                        fillColor: const Color(0xFFEFE5CE),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _submitTicket,
                        style: FilledButton.styleFrom(
                          backgroundColor: StitchTheme.adwaGold,
                          foregroundColor: StitchTheme.darkText,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        child: Text(
                          'Activate Scanner',
                          style: StitchTheme.overline(
                            size: 12,
                            color: StitchTheme.darkText,
                            letterSpacing: 1.8,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: widget.showBottomNav
          ? const StitchBottomNav(activeIndex: 2, lightMode: true)
          : null,
    );
  }
}
